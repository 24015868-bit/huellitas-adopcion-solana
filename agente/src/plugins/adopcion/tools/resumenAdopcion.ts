/**
 * TOOL: descripcion de la herramienta que ve el modelo (formato OpenAI / LM Studio).
 * Dice QUE hace y QUE argumentos acepta. La ejecucion real esta en la action del mismo nombre.
 */
export const herramientaResumenAdopcion = {
  type: "function" as const,
  function: {
    name: "resumen_adopciones",
    description:
      "Consulta en Solana Devnet el estado del portal de adopcion Huellitas en Casa y devuelve un resumen calculado: " +
      "refugios, mascotas (por estado y especie), solicitudes (pendientes, aprobadas, rechazadas), tasa de adopcion, " +
      "detalle de cada mascota e inconsistencias entre cuentas. Usala para CUALQUIER pregunta sobre cifras o estado del negocio.",
    parameters: {
      type: "object",
      properties: {
        refugio: {
          type: "string",
          description:
            "Opcional. Direccion (clave publica) del refugio o de su autoridad para limitar el resumen a ese refugio. Si no se indica, se resumen todos.",
        },
      },
      required: [] as string[],
    },
  },
};
