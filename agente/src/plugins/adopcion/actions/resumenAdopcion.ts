import type { Program, Idl } from "@coral-xyz/anchor";
import { calcularResumen, type Fila, type Resumen } from "./calculo";

export type ArgsResumen = { refugio?: string };

/** ACTION: ejecuta la consulta. Lee Refugio, Mascota y Solicitud del programa y calcula el resumen. */
export async function resumenAdopcion(args: ArgsResumen, ctx: { program: Program<Idl> }): Promise<Resumen> {
  const refugio = typeof args?.refugio === "string" && args.refugio.length <= 64 ? args.refugio : undefined;
  const cuentas: any = ctx.program.account;
  const [refugios, mascotas, solicitudes] = await Promise.all([
    cuentas.refugio.all(),
    cuentas.mascota.all(),
    cuentas.solicitud.all(),
  ]);
  const aFila = (x: any): Fila => ({ pubkey: x.publicKey.toBase58(), account: x.account });
  return calcularResumen(
    { refugios: refugios.map(aFila), mascotas: mascotas.map(aFila), solicitudes: solicitudes.map(aFila) },
    { refugio }
  );
}
