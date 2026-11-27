import { test } from "node:test";
import assert from "node:assert/strict";
import { Keypair } from "@solana/web3.js";
import { SolanaAgentKit, KeypairWallet } from "solana-agent-kit";
import AdopcionPlugin from "../src/plugins/adopcion";
import Action from "../src/plugins/adopcion/actions/resumenNegocio";
import { escenario, levantarRpc } from "./helpers";

const kit = (url: string) => new SolanaAgentKit(new KeypairWallet(Keypair.generate(), url), url, {}).use(AdopcionPlugin);

test("action: nombre, esquema vacio y registro en el plugin", () => {
  assert.equal(Action.name, "ADOPCION_RESUMEN_NEGOCIO");
  assert.deepEqual(Action.schema.parse({}), {});
  assert.ok(Action.description.length > 50);
  assert.equal(AdopcionPlugin.actions[0], Action);
});

test("tool: calcula indicadores desde cuentas reales (RPC simulado)", async () => {
  const d = await escenario();
  const rpc = await levantarRpc(d);
  try {
    const r: any = await Action.handler(kit(rpc.url), {});
    // handler lee OWNER del entorno
    assert.equal(r.status, "error"); // sin OWNER
  } finally {
    await rpc.cerrar();
  }
});

test("tool: con OWNER devuelve resumen correcto", async () => {
  const d = await escenario();
  const rpc = await levantarRpc(d);
  process.env.OWNER = d.autoridad.toBase58();
  try {
    const r: any = await Action.handler(kit(rpc.url), {});
    assert.equal(r.status, "success");
    const x = r.result;
    assert.equal(x.existe, true);
    assert.equal(x.direccion_refugio, d.refugioPda.toBase58());
    assert.equal(x.total_mascotas, 3);
    assert.deepEqual(x.mascotas_por_estado, { disponible: 2, adoptada: 1 });
    assert.deepEqual(x.mascotas_por_especie, { perro: 1, gato: 2 });
    assert.equal(x.edad_promedio_meses, 14);
    assert.deepEqual(x.solicitudes_por_estado, { pendiente: 2, aprobada: 1, rechazada: 0 });
    assert.equal(x.tasa_adopcion_pct, 33.3);
    assert.deepEqual(x.mascota_mas_solicitada, { nombres: ["Firulais"], solicitudes_pendientes: 2, empate: false });
    assert.deepEqual(x.inconsistencias, []);
  } finally {
    delete process.env.OWNER;
    await rpc.cerrar();
  }
});

test("tool: sin registro devuelve existe=false con motivo (sin inventar datos)", async () => {
  const rpc = await levantarRpc(null);
  const otro = Keypair.generate().publicKey.toBase58();
  process.env.OWNER = otro;
  try {
    const r: any = await Action.handler(kit(rpc.url), {});
    assert.equal(r.status, "success");
    assert.equal(r.result.existe, false);
    assert.match(r.result.motivo, /No existe un refugio/);
    assert.equal(r.result.total_mascotas, undefined);
  } finally {
    delete process.env.OWNER;
    await rpc.cerrar();
  }
});

test("tool: OWNER invalido da error claro", async () => {
  process.env.OWNER = "no-es-una-direccion";
  try {
    const r: any = await Action.handler(kit("http://127.0.0.1:1"), {});
    assert.equal(r.status, "error");
    assert.match(r.message, /OWNER/);
  } finally {
    delete process.env.OWNER;
  }
});
