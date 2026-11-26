import test from "node:test";
import assert from "node:assert/strict";
import { Keypair } from "@solana/web3.js";
import { calcularResumen, type Fila } from "../src/plugins/adopcion/actions/calculo";

const pk = () => Keypair.generate().publicKey;
const autoridad = pk();
const refugioPda = pk();
const adoptante = pk();

const refugio = (extra: object = {}): Fila => ({
  pubkey: refugioPda.toBase58(),
  account: { autoridad, nombre: "Huellitas en Casa", totalMascotas: 4, mascotasActivas: 3, totalAdopciones: 1, ...extra },
});
const mascota = (nombre: string, especie: string, edad: number, estado: string, pend: number, adop: any = null): Fila => ({
  pubkey: pk().toBase58(),
  account: { refugio: refugioPda, nombre, especie: { [especie]: {} }, edadMeses: edad, estado: { [estado]: {} }, solicitudesPendientes: pend, adoptante: adop },
});
const solicitud = (m: Fila, estado: string): Fila => ({
  pubkey: pk().toBase58(),
  account: { mascota: m.pubkey, adoptante, estado: { [estado]: {} }, mensaje: "" },
});

test("calcula cifras de mascotas, solicitudes y tasa", () => {
  const boni = mascota("Boni", "perro", 12, "disponible", 1);
  const milo = mascota("Milo", "gato", 24, "disponible", 0);
  const luna = mascota("Luna", "perro", 36, "adoptada", 0, adoptante);
  const r = calcularResumen({
    refugios: [refugio()],
    mascotas: [boni, milo, luna],
    solicitudes: [solicitud(boni, "pendiente"), solicitud(luna, "aprobada"), solicitud(milo, "rechazada")],
  });
  assert.equal(r.encontrado, true);
  assert.deepEqual(r.mascotas.porEstado, { disponible: 2, adoptada: 1 });
  assert.deepEqual(r.mascotas.porEspecie, { perro: 2, gato: 1 });
  assert.equal(r.mascotas.edadPromedioMeses, 24);
  assert.equal(r.mascotas.conSolicitudesPendientes, 1);
  assert.deepEqual(r.solicitudes, { total: 3, pendientes: 1, aprobadas: 1, rechazadas: 1 });
  assert.equal(r.tasaAdopcionPct, 25); // 1 adopcion de 4 registradas (historico)
  assert.deepEqual(r.inconsistencias, []);
  assert.equal(r.detalleMascotas.find((d) => d.nombre === "Luna")?.adoptante, adoptante.toBase58());
});

test("detecta inconsistencias entre contadores y cuentas", () => {
  const boni = mascota("Boni", "perro", 12, "disponible", 2); // declara 2 pendientes pero no hay solicitudes
  const r = calcularResumen({ refugios: [refugio({ mascotasActivas: 5 })], mascotas: [boni], solicitudes: [] });
  assert.equal(r.inconsistencias.length, 2);
  assert.match(r.inconsistencias[0], /declara 5 mascotas activas/);
  assert.match(r.inconsistencias[1], /Boni/);
});

test("sin datos: tasa nula y mensaje claro", () => {
  const r = calcularResumen({ refugios: [], mascotas: [], solicitudes: [] });
  assert.equal(r.encontrado, false);
  assert.equal(r.tasaAdopcionPct, null);
  assert.match(r.mensaje!, /No hay refugios/);
});

test("filtra por refugio (por PDA o por autoridad) y rechaza uno inexistente", () => {
  const boni = mascota("Boni", "perro", 12, "disponible", 0);
  const entrada = { refugios: [refugio({ totalMascotas: 1, mascotasActivas: 1, totalAdopciones: 0 })], mascotas: [boni], solicitudes: [] };
  assert.equal(calcularResumen(entrada, { refugio: refugioPda.toBase58() }).mascotas.total, 1);
  assert.equal(calcularResumen(entrada, { refugio: autoridad.toBase58() }).mascotas.total, 1);
  const otro = calcularResumen(entrada, { refugio: pk().toBase58() });
  assert.equal(otro.encontrado, false);
  assert.match(otro.mensaje!, /No encontre un refugio/);
});

test("una mascota con solicitud pendiente se marca en el detalle", () => {
  const boni = mascota("Boni", "perro", 12, "disponible", 1);
  const r = calcularResumen({ refugios: [refugio({ totalMascotas: 1, mascotasActivas: 1, totalAdopciones: 0 })], mascotas: [boni], solicitudes: [solicitud(boni, "pendiente")] });
  assert.equal(r.detalleMascotas[0].solicitudesPendientes, 1);
  assert.equal(r.tasaAdopcionPct, 0);
});
