/**
 * Calculo de los indicadores del negocio. Funcion PURA (sin red): recibe cuentas ya leidas y devuelve cifras.
 * Los conteos y las sumas se hacen aqui, en TypeScript; el modelo solo los explica.
 * Todos los campos del resultado son JSON seguro (este programa no usa u64/bigint: solo u8, u16 y u32).
 */
export type Fila = { pubkey: string; account: any };

export type ResumenNegocio = {
  existe: true;
  direccion_refugio: string;
  refugio: {
    nombre: string;
    autoridad: string;
    mascotas_registradas_historico: number;
    mascotas_activas: number;
    adopciones_aprobadas: number;
  };
  total_mascotas: number;
  mascotas_por_estado: { disponible: number; adoptada: number };
  mascotas_por_especie: { perro: number; gato: number };
  edad_promedio_meses: number | null;
  total_solicitudes: number;
  solicitudes_por_estado: { pendiente: number; aprobada: number; rechazada: number };
  tasa_adopcion_pct: number | null;
  mascota_mas_solicitada: { nombres: string[]; solicitudes_pendientes: number; empate: boolean } | null;
  nota_mascota_mas_solicitada?: string;
  mascotas: {
    id: number;
    nombre: string;
    direccion: string;
    especie: string;
    edad_meses: number;
    estado: string;
    solicitudes_pendientes: number;
    adoptante: string | null;
  }[];
  inconsistencias: string[];
};

export type ResumenSinRefugio = { existe: false; direccion_refugio: string; motivo: string };

const b58 = (x: any): string => (typeof x === "string" ? x : x.toBase58());
const clave = (o: any): string => (o && typeof o === "object" ? Object.keys(o)[0] ?? "desconocido" : "desconocido");
const redondear = (n: number) => Math.round(n * 10) / 10;

export function calcularResumen(entrada: { refugio: Fila; mascotas: Fila[]; solicitudes: Fila[] }): ResumenNegocio {
  const { refugio, mascotas, solicitudes } = entrada;

  const porEstado = { disponible: 0, adoptada: 0 };
  const porEspecie = { perro: 0, gato: 0 };
  for (const m of mascotas) {
    const e = clave(m.account.estado) as keyof typeof porEstado;
    if (e in porEstado) porEstado[e] += 1;
    const sp = clave(m.account.especie) as keyof typeof porEspecie;
    if (sp in porEspecie) porEspecie[sp] += 1;
  }

  const porSolicitud = { pendiente: 0, aprobada: 0, rechazada: 0 };
  const pendientesPorMascota = new Map<string, number>();
  for (const s of solicitudes) {
    const e = clave(s.account.estado) as keyof typeof porSolicitud;
    if (e in porSolicitud) porSolicitud[e] += 1;
    if (e === "pendiente") {
      const k = b58(s.account.mascota);
      pendientesPorMascota.set(k, (pendientesPorMascota.get(k) ?? 0) + 1);
    }
  }

  const inconsistencias: string[] = [];
  if (refugio.account.mascotasActivas !== mascotas.length) {
    inconsistencias.push(
      `El refugio "${refugio.account.nombre}" declara ${refugio.account.mascotasActivas} mascotas activas pero se encontraron ${mascotas.length} cuentas de mascota.`
    );
  }
  for (const m of mascotas) {
    const reales = pendientesPorMascota.get(m.pubkey) ?? 0;
    if (m.account.solicitudesPendientes !== reales) {
      inconsistencias.push(
        `La mascota "${m.account.nombre}" declara ${m.account.solicitudesPendientes} solicitudes pendientes pero se encontraron ${reales}.`
      );
    }
  }

  // "Mascota mas solicitada" = mayor numero de solicitudes PENDIENTES. Con empate se listan todas
  // las empatadas; si nadie tiene solicitudes pendientes no se presenta un ganador unico.
  const maximo = Math.max(0, ...pendientesPorMascota.values());
  const empatadas = mascotas.filter((m) => (pendientesPorMascota.get(m.pubkey) ?? 0) === maximo && maximo > 0);
  const masSolicitada =
    maximo > 0
      ? { nombres: empatadas.map((m) => m.account.nombre as string).sort(), solicitudes_pendientes: maximo, empate: empatadas.length > 1 }
      : null;

  const edades = mascotas.map((m) => m.account.edadMeses as number);
  const registradas = refugio.account.totalMascotas as number;

  return {
    existe: true,
    direccion_refugio: refugio.pubkey,
    refugio: {
      nombre: refugio.account.nombre,
      autoridad: b58(refugio.account.autoridad),
      mascotas_registradas_historico: registradas,
      mascotas_activas: refugio.account.mascotasActivas,
      adopciones_aprobadas: refugio.account.totalAdopciones,
    },
    total_mascotas: mascotas.length,
    mascotas_por_estado: porEstado,
    mascotas_por_especie: porEspecie,
    edad_promedio_meses: edades.length ? redondear(edades.reduce((a, b) => a + b, 0) / edades.length) : null,
    total_solicitudes: solicitudes.length,
    solicitudes_por_estado: porSolicitud,
    tasa_adopcion_pct: registradas > 0 ? redondear((refugio.account.totalAdopciones / registradas) * 100) : null,
    mascota_mas_solicitada: masSolicitada,
    ...(masSolicitada
      ? {}
      : { nota_mascota_mas_solicitada: "Ninguna mascota tiene solicitudes pendientes: no hay una mascota mas solicitada." }),
    mascotas: mascotas
      .map((m) => ({
        id: m.account.id as number,
        nombre: m.account.nombre as string,
        direccion: m.pubkey,
        especie: clave(m.account.especie),
        edad_meses: m.account.edadMeses as number,
        estado: clave(m.account.estado),
        solicitudes_pendientes: pendientesPorMascota.get(m.pubkey) ?? 0,
        adoptante: m.account.adoptante ? b58(m.account.adoptante) : null,
      }))
      .sort((a, b) => a.id - b.id),
    inconsistencias,
  };
}
