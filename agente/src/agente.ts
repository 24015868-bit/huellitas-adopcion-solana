import { herramientas } from "./plugins/adopcion";

export type ConfigModelo = { lmUrl: string; modelo?: string; temperatura?: number; maxPasos?: number };
export type Deps = {
  config: ConfigModelo;
  ejecutarHerramienta: (nombre: string, args: any) => Promise<unknown>;
  fetchFn?: typeof fetch;
};

export const PROMPT_SISTEMA = [
  "Eres el asistente de consulta del portal de adopcion Huellitas en Casa (programa de Solana en Devnet).",
  "Respondes en espanol, de forma breve y puntual.",
  "Para cualquier cifra o estado del negocio DEBES llamar a la herramienta resumen_adopciones y responder SOLO con lo que devuelva.",
  "Nunca inventes ni recalcules numeros: usa exactamente los de la herramienta. Si el dato no esta en el resultado, dilo.",
  "Eres de solo lectura: no puedes crear, aprobar ni modificar nada en la cadena. Si te lo piden, explica que se hace desde la aplicacion web con la wallet.",
  "Si hay inconsistencias en el resultado, mencionalas.",
].join("\n");

async function pedir(f: typeof fetch, url: string, init?: RequestInit): Promise<any> {
  let res: Response;
  try {
    res = await f(url, { ...init, signal: AbortSignal.timeout(180_000) });
  } catch (e: any) {
    throw new Error(
      `No pude conectar con LM Studio en ${url}. Abre LM Studio, carga un modelo con "Tool use" y activa el servidor (Developer -> Start Server). ` +
        `Mientras tanto puedes usar "npm run resumen" (sin modelo). Detalle: ${e?.cause?.code ?? e?.message ?? e}`
    );
  }
  if (!res.ok) throw new Error(`LM Studio respondio ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

/** Bucle del agente: pregunta -> el modelo pide la herramienta -> el codigo la ejecuta -> el modelo responde. */
export async function ejecutarAgente(pregunta: string, deps: Deps): Promise<string> {
  const f = deps.fetchFn ?? fetch;
  const base = deps.config.lmUrl.replace(/\/$/, "");
  let modelo = deps.config.modelo?.trim();
  if (!modelo) {
    const lista = await pedir(f, `${base}/models`);
    modelo = lista?.data?.[0]?.id;
    if (!modelo) throw new Error("LM Studio no reporta ningun modelo cargado. Carga uno y vuelve a intentar.");
  }

  const mensajes: any[] = [
    { role: "system", content: PROMPT_SISTEMA },
    { role: "user", content: pregunta },
  ];

  for (let paso = 0; paso < (deps.config.maxPasos ?? 4); paso++) {
    const data = await pedir(f, `${base}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: modelo,
        messages: mensajes,
        tools: herramientas,
        temperature: deps.config.temperatura ?? 0,
      }),
    });
    const msg = data?.choices?.[0]?.message;
    if (!msg) throw new Error("Respuesta inesperada del modelo.");
    mensajes.push(msg);

    if (!msg.tool_calls?.length) return String(msg.content ?? "").trim();

    for (const llamada of msg.tool_calls) {
      let resultado: unknown;
      try {
        const args = llamada.function?.arguments ? JSON.parse(llamada.function.arguments) : {};
        resultado = await deps.ejecutarHerramienta(llamada.function?.name, args);
      } catch (e: any) {
        resultado = { error: `Fallo la herramienta: ${e?.message ?? e}` };
      }
      mensajes.push({ role: "tool", tool_call_id: llamada.id, content: JSON.stringify(resultado) });
    }
  }
  return "No pude completar la consulta (demasiados pasos). Intenta reformular la pregunta.";
}
