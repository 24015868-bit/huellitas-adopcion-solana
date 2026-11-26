import type { Program, Idl } from "@coral-xyz/anchor";
import { herramientaResumenAdopcion } from "./tools/resumenAdopcion";
import { resumenAdopcion } from "./actions/resumenAdopcion";

/** Plugin: cada herramienta (tool) tiene su accion (action) con el mismo nombre. */
export const herramientas = [herramientaResumenAdopcion];

export function crearEjecutor(program: Program<Idl>) {
  const acciones: Record<string, (args: any) => Promise<unknown>> = {
    resumen_adopciones: (args) => resumenAdopcion(args, { program }),
  };
  return async (nombre: string, args: any): Promise<unknown> => {
    const accion = acciones[nombre];
    if (!accion) return { error: `Herramienta desconocida: ${nombre}` };
    return accion(args ?? {});
  };
}
