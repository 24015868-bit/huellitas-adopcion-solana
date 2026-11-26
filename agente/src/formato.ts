import type { Resumen } from "./plugins/adopcion/actions/calculo";

/** Texto legible del resumen (modo --sin-modelo: no usa ningun modelo, solo el calculo del codigo). */
export function formatearResumen(r: Resumen): string {
  if (!r.encontrado) return r.mensaje ?? "Sin datos.";
  const l: string[] = [];
  l.push(`Resumen de adopciones (Solana Devnet) · ${r.generadoEn}`);
  for (const f of r.refugios) {
    l.push(
      `Refugio "${f.nombre}" (${f.direccion}): ${f.mascotasActivas} mascotas activas de ${f.mascotasRegistradasHistorico} registradas · ${f.adopcionesAprobadas} adopciones aprobadas`
    );
  }
  const m = r.mascotas;
  l.push(`Mascotas: ${m.total} (disponibles ${m.porEstado.disponible}, adoptadas ${m.porEstado.adoptada}) · perros ${m.porEspecie.perro}, gatos ${m.porEspecie.gato}`);
  l.push(`Edad promedio: ${m.edadPromedioMeses ?? "n/d"} meses · con solicitudes pendientes: ${m.conSolicitudesPendientes}`);
  const s = r.solicitudes;
  l.push(`Solicitudes: ${s.total} (pendientes ${s.pendientes}, aprobadas ${s.aprobadas}, rechazadas ${s.rechazadas})`);
  l.push(`Tasa de adopcion: ${r.tasaAdopcionPct === null ? "n/d" : r.tasaAdopcionPct + "%"}`);
  if (r.detalleMascotas.length) {
    l.push("Detalle:");
    for (const d of r.detalleMascotas) {
      l.push(`  - ${d.nombre} (${d.especie}, ${d.edadMeses} meses): ${d.estado}${d.solicitudesPendientes ? `, ${d.solicitudesPendientes} solicitud(es) pendiente(s)` : ""}`);
    }
  }
  l.push(r.inconsistencias.length ? "Inconsistencias:\n  - " + r.inconsistencias.join("\n  - ") : "Inconsistencias: ninguna");
  return l.join("\n");
}
