import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";
import path from "node:path";
import { Keypair, PublicKey } from "@solana/web3.js";
import { utils } from "@coral-xyz/anchor";
import { crearProgramaSoloLectura } from "../src/programa";
import { crearEjecutor } from "../src/plugins/adopcion";
import { ejecutarAgente } from "../src/agente";

/** Servidor JSON-RPC minimo que imita getProgramAccounts con cuentas reales codificadas segun el IDL. */
async function levantarRpc() {
  const aut = Keypair.generate().publicKey;
  const adoptante = Keypair.generate().publicKey;
  const refugioPda = Keypair.generate().publicKey;
  const mascotaA = Keypair.generate().publicKey;
  const mascotaB = Keypair.generate().publicKey;
  const solPda = Keypair.generate().publicKey;

  // Programa solo para codificar (apunta a un RPC que no se usa)
  const prog: any = crearProgramaSoloLectura("http://127.0.0.1:1");
  const enc = (n: string, d: object) => prog.coder.accounts.encode(n, d);
  const cuentas: Record<string, { pubkey: PublicKey; data: Buffer }[]> = {
    refugio: [{ pubkey: refugioPda, data: await enc("refugio", { autoridad: aut, nombre: "Huellitas en Casa", totalMascotas: 3, mascotasActivas: 2, totalAdopciones: 1, bump: 255 }) }],
    mascota: [
      { pubkey: mascotaA, data: await enc("mascota", { refugio: refugioPda, id: 0, nombre: "Boni", especie: { perro: {} }, edadMeses: 12, estado: { disponible: {} }, adoptante: null, solicitudesPendientes: 1, bump: 255 }) },
      { pubkey: mascotaB, data: await enc("mascota", { refugio: refugioPda, id: 1, nombre: "Milo", especie: { gato: {} }, edadMeses: 24, estado: { adoptada: {} }, adoptante, solicitudesPendientes: 0, bump: 255 }) },
    ],
    solicitud: [{ pubkey: solPda, data: await enc("solicitud", { mascota: mascotaA, adoptante, mensaje: "hola", estado: { pendiente: {} }, bump: 255 }) }],
  };
  const disc: Record<string, string> = {};
  for (const n of Object.keys(cuentas)) disc[utils.bytes.bs58.encode(prog.coder.accounts.accountDiscriminator(n))] = n;

  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const { id, method, params } = JSON.parse(body);
      let result: unknown = null;
      if (method === "getProgramAccounts") {
        const bytes = params[1].filters.find((f: any) => f.memcmp)?.memcmp.bytes;
        const lista = cuentas[disc[bytes]] ?? [];
        result = lista.map((c) => ({
          pubkey: c.pubkey.toBase58(),
          account: { data: [c.data.toString("base64"), "base64"], executable: false, lamports: 1, owner: prog.programId.toBase58(), rentEpoch: 0, space: c.data.length },
        }));
      }
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ jsonrpc: "2.0", id, result }));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  return { server, url: `http://127.0.0.1:${(server.address() as any).port}` };
}

/** Modelo simulado compatible con OpenAI/LM Studio: 1) pide la herramienta, 2) responde usando su resultado. */
async function levantarModelo(registro: any[]) {
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      res.setHeader("content-type", "application/json");
      if (req.url?.endsWith("/models")) return void res.end(JSON.stringify({ data: [{ id: "modelo-simulado" }] }));
      const peticion = JSON.parse(body);
      registro.push(peticion);
      const herr = peticion.messages.find((m: any) => m.role === "tool");
      if (!herr) {
        return void res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: null, tool_calls: [{ id: "call_1", type: "function", function: { name: "resumen_adopciones", arguments: "{}" } }] } }] }));
      }
      const r = JSON.parse(herr.content);
      res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: `Hay ${r.mascotas.porEstado.disponible} mascota disponible y ${r.solicitudes.pendientes} solicitud pendiente.` } }] }));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  return { server, url: `http://127.0.0.1:${(server.address() as any).port}/v1` };
}

test("la action lee las cuentas por RPC y calcula el resumen", async () => {
  const rpc = await levantarRpc();
  try {
    const ejecutar = crearEjecutor(crearProgramaSoloLectura(rpc.url));
    const r: any = await ejecutar("resumen_adopciones", {});
    assert.equal(r.refugios[0].nombre, "Huellitas en Casa");
    assert.deepEqual(r.mascotas.porEstado, { disponible: 1, adoptada: 1 });
    assert.deepEqual(r.solicitudes, { total: 1, pendientes: 1, aprobadas: 0, rechazadas: 0 });
    assert.equal(r.tasaAdopcionPct, 33.3);
    // el refugio declara 2 activas y existen 2 cuentas: sin inconsistencias
    assert.deepEqual(r.inconsistencias, []);
    assert.deepEqual(await ejecutar("herramienta_que_no_existe", {}), { error: "Herramienta desconocida: herramienta_que_no_existe" });
  } finally {
    rpc.server.close();
  }
});

test("el agente completa el ciclo pregunta -> herramienta -> respuesta", async () => {
  const rpc = await levantarRpc();
  const peticiones: any[] = [];
  const lm = await levantarModelo(peticiones);
  try {
    const texto = await ejecutarAgente("¿Cuántas mascotas hay disponibles?", {
      config: { lmUrl: lm.url },
      ejecutarHerramienta: crearEjecutor(crearProgramaSoloLectura(rpc.url)),
    });
    assert.equal(texto, "Hay 1 mascota disponible y 1 solicitud pendiente.");
    assert.equal(peticiones.length, 2);
    assert.equal(peticiones[0].model, "modelo-simulado"); // autodetectado
    assert.equal(peticiones[0].temperature, 0);
    assert.equal(peticiones[0].tools[0].function.name, "resumen_adopciones");
    assert.match(peticiones[0].messages[0].content, /solo lectura/);
  } finally {
    rpc.server.close();
    lm.server.close();
  }
});

test("si LM Studio no esta disponible el error es claro y sugiere el modo sin modelo", async () => {
  await assert.rejects(
    ejecutarAgente("hola", { config: { lmUrl: "http://127.0.0.1:1/v1", modelo: "x" }, ejecutarHerramienta: async () => ({}) }),
    /No pude conectar con LM Studio[\s\S]*npm run resumen/
  );
});

test("CLI --sin-modelo imprime el resumen calculado sin usar ningun modelo", async () => {
  const rpc = await levantarRpc();
  try {
    const salida = await new Promise<string>((resolve, reject) => {
      const p = spawn(process.execPath, ["--import", "tsx", path.resolve(__dirname, "../src/index.ts"), "--sin-modelo"], {
        env: { ...process.env, RPC_URL: rpc.url },
      });
      let out = "";
      p.stdout.on("data", (d) => (out += d));
      p.stderr.on("data", (d) => (out += d));
      p.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(out))));
    });
    assert.match(salida, /Refugio "Huellitas en Casa"/);
    assert.match(salida, /Solicitudes: 1 \(pendientes 1/);
    assert.match(salida, /Boni .*disponible, 1 solicitud/);
  } finally {
    rpc.server.close();
  }
});
