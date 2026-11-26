/**
 * Calculo del resumen del negocio. Es una funcion PURA (sin red): recibe las cuentas ya leidas
 * y devuelve cifras. Los numeros los calcula el codigo, nunca el modelo.
 */
export type Fila = { pubkey: string; account: any };

export type Entrada = { refugios: Fila[]; mascotas: Fila[]; solicitudes: Fila[] };

export type Resumen = {
  generadoEn: string;
  encontrado: boolean;
  mensaje?: string;
  refugios: {
    nombre: string;
    direccion: string;
    autoridad: string;
    mascotasRegistradasHistorico: number;
    mascotasActivas: number;
    adopcionesAprobadas: number;
  }[];
  mascotas: {
    total: number;
    porEstado: { disponible: number; adoptada: number };
    porEspecie: { perro: number; gato: number };
    edadPromedioMeses: number | null;
    conSolicitudesPendientes: number;
  };
  solicitudes: { total: number; pendientes: number; aprobadas: number; rechazadas: number };
  tasaAdopcionPct: number | null;
  detalleMascotas: {
    nombre: string;
    especie: string;
    edadMeses: number;
    estado: string;
    solicitudesPendientes: number;
    adoptante: string | null;
  }[];
  inconsistencias: string[];
};

const b58 = (x: any): string => (typeof x === "string" ? x : x.toBase58());
const clave = (o: any): string => (o && typeof o === "object" ? Object.keys(o)[0] ?? "desconocido" : "desconocido");
const redondear = (n: number) => Math.round(n * 10) / 10;

export function calcularResumen(
  entrada: Entrada,
  opciones: { refugio?: string } = {},
  ahora: Date = new Date()
): Resumen {
  const filtro = opciones.refugio?.trim();
  const refugios = entrada.refugios.filter(
    (r) => !filtro || r.pubkey === filtro || b58(r.account.autoridad) === filtro
  );

  const vacio = (mensaje: string): Resumen => ({
    generadoEn: ahora.toISOString(),
    encontrado: false,
    mensaje,
    refugios: [],
    mascotas: {
      total: 0,
      porEstado: { disponible: 0, adoptada: 0 },
      porEspecie: { perro: 0, gato: 0 },
      edadPromedioMeses: null,
      conSolicitudesPendientes: 0,
    },
    solicitudes: { total: 0, pendientes: 0, aprobadas: 0, rechazadas: 0 },
    tasaAdopcionPct: null,
    detalleMascotas: [],
    inconsistencias: [],
  });

  if (refugios.length === 0) {
    return vacio(filtro ? `No encontre un refugio con la direccion ${filtro}.` : "No hay refugios registrados en el programa.");
  }

  const idsRefugios = new Set(refugios.map((r) => r.pubkey));
  const mascotas = entrada.mascotas.filter((m) => idsRefugios.has(b58(m.account.refugio)));
  const idsMascotas = new Set(mascotas.map((m) => m.pubkey));
  const solicitudes = entrada.solicitudes.filter((s) => idsMascotas.has(b58(s.account.mascota)));

  const porEstado = { disponible: 0, adoptada: 0 };
  const porEspecie = { perro: 0, gato: 0 };
  for (const m of mascotas) {
    const e = clave(m.account.estado) as keyof typeof porEstado;
    if (e in porEstado) porEstado[e] += 1;
    const sp = clave(m.account.especie) as keyof typeof porEspecie;
    if (sp in porEspecie) porEspecie[sp] += 1;
  }

  const sol = { total: solicitudes.length, pendientes: 0, aprobadas: 0, rechazadas: 0 };
  const pendientesPorMascota = new Map<string, number>();
  for (const s of solicitudes) {
    const e = clave(s.account.estado);
    if (e === "pendiente") {
      sol.pendientes += 1;
      const k = b58(s.account.mascota);
      pendientesPorMascota.set(k, (pendientesPorMascota.get(k) ?? 0) + 1);
    } else if (e === "aprobada") sol.aprobadas += 1;
    else if (e === "rechazada") sol.rechazadas += 1;
  }

  const inconsistencias: string[] = [];
  for (const r of refugios) {
    const cuentas = mascotas.filter((m) => b58(m.account.refugio) === r.pubkey).length;
    if (r.account.mascotasActivas !== cuentas) {
      inconsistencias.push(
        `El refugio "${r.account.nombre}" declara ${r.account.mascotasActivas} mascotas activas pero se encontraron ${cuentas} cuentas de mascota.`
      );
    }
  }
  for (const m of mascotas) {
    const reales = pendientesPorMascota.get(m.pubkey) ?? 0;
    if (m.account.solicitudesPendientes !== reales) {
      inconsistencias.push(
        `La mascota "${m.account.nombre}" declara ${m.account.solicitudesPendientes} solicitudes pendientes pero se encontraron ${reales}.`
      );
    }
  }

  const totalRegistradas = refugios.reduce((a, r) => a + r.account.totalMascotas, 0);
  const totalAdopciones = refugios.reduce((a, r) => a + r.account.totalAdopciones, 0);
  const edades = mascotas.map((m) => m.account.edadMeses as number);

  return {
    generadoEn: ahora.toISOString(),
    encontrado: true,
    refugios: refugios.map((r) => ({
      nombre: r.account.nombre,
      direccion: r.pubkey,
      autoridad: b58(r.account.autoridad),
      mascotasRegistradasHistorico: r.account.totalMascotas,
      mascotasActivas: r.account.mascotasActivas,
      adopcionesAprobadas: r.account.totalAdopciones,
    })),
    mascotas: {
      total: mascotas.length,
      porEstado,
      porEspecie,
      edadPromedioMeses: edades.length ? redondear(edades.reduce((a, b) => a + b, 0) / edades.length) : null,
      conSolicitudesPendientes: [...pendientesPorMascota.values()].filter((n) => n > 0).length,
    },
    solicitudes: sol,
    tasaAdopcionPct: totalRegistradas > 0 ? redondear((totalAdopciones / totalRegistradas) * 100) : null,
    detalleMascotas: mascotas
      .map((m) => ({
        nombre: m.account.nombre as string,
        especie: clave(m.account.especie),
        edadMeses: m.account.edadMeses as number,
        estado: clave(m.account.estado),
        solicitudesPendientes: pendientesPorMascota.get(m.pubkey) ?? 0,
        adoptante: m.account.adoptante ? b58(m.account.adoptante) : null,
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    inconsistencias,
  };
}
