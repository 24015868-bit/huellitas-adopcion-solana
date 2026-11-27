import { PublicKey } from "@solana/web3.js";
import type { SolanaAgentKit } from "solana-agent-kit";
import { crearProgramaSoloLectura } from "../../../lib/programa";
import { pdaRefugio } from "../../../lib/pdas";
import { calcularResumen, type Fila, type ResumenNegocio, type ResumenSinRefugio } from "../../../lib/calculo";

const aFila = (x: any): Fila => ({ pubkey: x.publicKey.toBase58(), account: x.account });
const filtroPorReferencia = (referencia: PublicKey) => [{ memcmp: { offset: 8, bytes: referencia.toBase58() } }];

/**
 * TOOL: funcion que consulta las cuentas y calcula resultados (no la ve el modelo directamente).
 * Recorrido: autoridad (OWNER) -> PDA del refugio -> existe? -> mascotas del refugio -> solicitudes de cada mascota -> indicadores.
 * Las referencias se siguen con un filtro memcmp sobre el campo `refugio` / `mascota` (offset 8, tras el discriminador).
 */
export async function resumenNegocio(agent: SolanaAgentKit, owner: string | undefined = process.env.OWNER): Promise<ResumenNegocio | ResumenSinRefugio> {
  if (!owner?.trim()) throw new Error("Falta la variable OWNER (direccion publica de la autoridad del refugio).");
  let autoridad: PublicKey;
  try {
    autoridad = new PublicKey(owner.trim());
  } catch {
    throw new Error(`OWNER no es una direccion valida de Solana: ${owner}`);
  }

  const program: any = crearProgramaSoloLectura(agent.connection.rpcEndpoint);
  const refugioPda = pdaRefugio(autoridad, program.programId);
  const cuenta = await program.account.refugio.fetchNullable(refugioPda);
  if (!cuenta) {
    return {
      existe: false,
      direccion_refugio: refugioPda.toBase58(),
      motivo: `No existe un refugio para la autoridad ${autoridad.toBase58()} en el programa ${program.programId.toBase58()} (red: ${agent.connection.rpcEndpoint}). Revisa OWNER, el Program ID y la red.`,
    };
  }

  const mascotas = (await program.account.mascota.all(filtroPorReferencia(refugioPda))).map(aFila);
  const solicitudes = (
    await Promise.all(mascotas.map((m: Fila) => program.account.solicitud.all(filtroPorReferencia(new PublicKey(m.pubkey)))))
  )
    .flat()
    .map(aFila);

  return calcularResumen({ refugio: { pubkey: refugioPda.toBase58(), account: cuenta }, mascotas, solicitudes });
}
