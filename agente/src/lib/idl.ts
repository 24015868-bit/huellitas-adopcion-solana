import fs from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Carga el IDL del programa. Por defecto reutiliza el del frontend (frontend/src/idl/adopcion.json),
 * igual que el taller reutiliza el cliente generado de la app. PROGRAM_ID permite apuntar a otro despliegue.
 */
export function cargarIdl(ruta?: string): any {
  const destino = ruta ?? process.env.IDL_PATH ?? fileURLToPath(new URL("../../../frontend/src/idl/adopcion.json", import.meta.url));
  const idl = JSON.parse(fs.readFileSync(destino, "utf-8"));
  const programId = process.env.PROGRAM_ID?.trim();
  return programId ? { ...idl, address: programId } : idl;
}
