import fs from "node:fs";
import path from "node:path";

/** Carga el IDL del programa. Por defecto reutiliza el del frontend (frontend/src/idl/adopcion.json). */
export function cargarIdl(ruta?: string): any {
  const destino = ruta ?? process.env.IDL_PATH ?? path.resolve(__dirname, "../../frontend/src/idl/adopcion.json");
  const idl = JSON.parse(fs.readFileSync(destino, "utf-8"));
  const programId = process.env.PROGRAM_ID?.trim();
  return programId ? { ...idl, address: programId } : idl;
}
