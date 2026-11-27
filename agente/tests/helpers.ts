import http from "node:http";
import { BorshAccountsCoder } from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { cargarIdl } from "../src/lib/idl";
import { pdaMascota, pdaRefugio, pdaSolicitud } from "../src/lib/pdas";

const idl = cargarIdl();
export const PROGRAM_ID = new PublicKey(idl.address);
const coder = new BorshAccountsCoder(idl);

export type Datos = { autoridad: PublicKey; refugio: any; mascotas: any[]; solicitudes: any[] };

/** Construye cuentas reales (codificadas con el IDL) para el escenario de prueba. */
export async function escenario() {
  const autoridad = Keypair.generate().publicKey;
  const refugioPda = pdaRefugio(autoridad, PROGRAM_ID);
  const adoptA = Keypair.generate().publicKey;
  const adoptB = Keypair.generate().publicKey;
  const mk = (id: number, nombre: string, especie: any, edad: number, estado: any, pend: number, adoptante: PublicKey | null) => ({
    pda: pdaMascota(refugioPda, id, PROGRAM_ID),
    data: { refugio: refugioPda, id, nombre, especie, edad_meses: edad, estado, adoptante, solicitudes_pendientes: pend, bump: 255 },
  });
  const m0 = mk(0, "Luna", { Gato: {} }, 12, { Adoptada: {} }, 0, adoptA);
  const m1 = mk(1, "Firulais", { Perro: {} }, 24, { Disponible: {} }, 2, null);
  const m2 = mk(2, "Nube", { Gato: {} }, 6, { Disponible: {} }, 0, null);
  const sol = (m: any, adoptante: PublicKey, mensaje: string, estado: any) => ({
    pda: pdaSolicitud(m.pda, adoptante, PROGRAM_ID),
    data: { mascota: m.pda, adoptante, mensaje, estado, bump: 255 },
  });
  const datos = {
    autoridad,
    refugioPda,
    refugio: { autoridad, nombre: "Huellitas en Casa", total_mascotas: 3, mascotas_activas: 3, total_adopciones: 1, bump: 255 },
    mascotas: [m0, m1, m2],
    solicitudes: [sol(m0, adoptA, "hola", { Aprobada: {} }), sol(m1, adoptA, "yo", { Pendiente: {} }), sol(m1, adoptB, "yo tambien", { Pendiente: {} })],
  };
  return datos;
}

const b64 = (buf: Buffer) => [buf.toString("base64"), "base64"];
const info = (buf: Buffer) => ({ data: b64(buf), executable: false, lamports: 1_000_000, owner: PROGRAM_ID.toBase58(), rentEpoch: 0, space: buf.length });

/** Servidor JSON-RPC minimo que imita getAccountInfo y getProgramAccounts (con filtro memcmp). */
export async function levantarRpc(d: Awaited<ReturnType<typeof escenario>> | null) {
  const cuentas: { pubkey: string; tipo: string; buf: Buffer; data: any }[] = [];
  if (d) {
    const add = async (pda: PublicKey, tipo: string, data: any) =>
      cuentas.push({ pubkey: pda.toBase58(), tipo, data, buf: await coder.encode(tipo, data) });
    await add(d.refugioPda, "Refugio", d.refugio);
    for (const m of d.mascotas) await add(m.pda, "Mascota", m.data);
    for (const s of d.solicitudes) await add(s.pda, "Solicitud", s.data);
  }
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const r = JSON.parse(body);
      const responder = (result: any) => {
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ jsonrpc: "2.0", id: r.id, result }));
      };
      const ctx = { context: { slot: 1 } };
      if (r.method === "getAccountInfo") {
        const c = cuentas.find((x) => x.pubkey === r.params[0]);
        return responder({ ...ctx, value: c ? info(c.buf) : null });
      }
      if (r.method === "getProgramAccounts") {
        const filtros: any[] = r.params[1]?.filters ?? [];
        const sal = cuentas
          .filter((c) =>
            filtros.every((f) => {
              if (f.dataSize) return c.buf.length === f.dataSize;
              if (f.memcmp) { const esperado = Buffer.from(bs58.decode(f.memcmp.bytes)); return Buffer.from(c.buf).subarray(f.memcmp.offset, f.memcmp.offset + esperado.length).equals(esperado); }
              return true;
            })
          )
          .map((c) => ({ pubkey: c.pubkey, account: info(c.buf) }));
        return responder(sal);
      }
      responder(null);
    });
  });
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
  const url = `http://127.0.0.1:${(server.address() as any).port}`;
  return { url, cerrar: () => new Promise((ok) => { server.close(ok); server.closeAllConnections(); }) };
}
