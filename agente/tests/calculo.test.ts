import { test } from "node:test";
import assert from "node:assert/strict";
import { Keypair } from "@solana/web3.js";
import { calcularResumen } from "../src/lib/calculo";

const pk = () => Keypair.generate().publicKey.toBase58();
const refugio = (o: any = {}) => ({ pubkey: pk(), account: { autoridad: pk(), nombre: "R", totalMascotas: 2, mascotasActivas: 2, totalAdopciones: 0, ...o } });
const masc = (id: number, pend: number, o: any = {}) => ({
  pubkey: pk(),
  account: { id, nombre: `M${id}`, especie: { perro: {} }, edadMeses: 10, estado: { disponible: {} }, adoptante: null, solicitudesPendientes: pend, ...o },
});
const sol = (m: any, estado: any) => ({ pubkey: pk(), account: { mascota: m.pubkey, adoptante: pk(), mensaje: "", estado } });

test("empate: lista todas las empatadas", () => {
  const a = masc(0, 1), b = masc(1, 1);
  const r = calcularResumen({ refugio: refugio(), mascotas: [a, b], solicitudes: [sol(a, { pendiente: {} }), sol(b, { pendiente: {} })] });
  assert.deepEqual(r.mascota_mas_solicitada, { nombres: ["M0", "M1"], solicitudes_pendientes: 1, empate: true });
});

test("sin solicitudes pendientes: no hay ganador unico", () => {
  const a = masc(0, 0), b = masc(1, 0);
  const r = calcularResumen({ refugio: refugio(), mascotas: [a, b], solicitudes: [] });
  assert.equal(r.mascota_mas_solicitada, null);
  assert.ok(r.nota_mascota_mas_solicitada);
  assert.equal(r.tasa_adopcion_pct, 0);
});

test("detecta inconsistencias de contadores", () => {
  const a = masc(0, 3);
  const r = calcularResumen({ refugio: refugio({ mascotasActivas: 5 }), mascotas: [a], solicitudes: [] });
  assert.equal(r.inconsistencias.length, 2);
});

test("sin mascotas: edad promedio nula y tasa nula si nunca se registro nada", () => {
  const r = calcularResumen({ refugio: refugio({ totalMascotas: 0, mascotasActivas: 0 }), mascotas: [], solicitudes: [] });
  assert.equal(r.edad_promedio_meses, null);
  assert.equal(r.tasa_adopcion_pct, null);
});
