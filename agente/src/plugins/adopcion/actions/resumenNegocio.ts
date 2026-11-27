import { z } from "zod";
import { resumenNegocio } from "../tools/resumenNegocio";

type AgentAction = {
  name: string;
  description: string;
  similes: string[];
  examples: any[];
  schema: any;
  handler: (agent: any, input: any) => Promise<any>;
};

/**
 * ACTION: nombre, descripcion, esquema de entrada y handler que expone la herramienta al modelo.
 * El esquema esta vacio: el refugio se localiza con OWNER (entorno), el modelo no manda parametros.
 */
const AdopcionResumenNegocioAction: AgentAction = {
  name: "ADOPCION_RESUMEN_NEGOCIO",
  description:
    "Consulta en Solana Devnet el estado ACTIVO del refugio de adopcion configurado (Huellitas en Casa) y devuelve un resumen calculado: " +
    "existe, direccion_refugio, mascotas por estado y especie, solicitudes pendientes/aprobadas/rechazadas, tasa_adopcion_pct, " +
    "mascota_mas_solicitada (con empates), detalle de cada mascota e inconsistencias. " +
    "Usala para CUALQUIER pregunta sobre cifras o estado del refugio, mascotas o solicitudes. Si existe es false, informa el motivo y no inventes datos.",
  similes: ["resumen del refugio", "cuantas mascotas hay", "solicitudes pendientes", "tasa de adopcion", "direccion de mi refugio"],
  examples: [
    [
      {
        input: {},
        output: { status: "success", result: { existe: true, total_mascotas: 4, solicitudes_por_estado: { pendiente: 1, aprobada: 0, rechazada: 0 } } },
        explanation: "Resumen del estado activo del refugio",
      },
    ],
  ],
  schema: z.object({}),
  handler: async (agent: any) => {
    try {
      return { status: "success", result: await resumenNegocio(agent) };
    } catch (e) {
      return { status: "error", message: (e as Error).message };
    }
  },
};

export default AdopcionResumenNegocioAction;
