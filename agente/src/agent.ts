import "dotenv/config";
import * as readline from "node:readline";
import { Keypair } from "@solana/web3.js";
import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { SolanaAgentKit, createLangchainTools, KeypairWallet } from "solana-agent-kit";
import AdopcionPlugin from "./plugins/adopcion";

const faltan = ["RPC_URL", "OWNER", "LLM_BASE_URL", "LLM_MODEL"].filter((k) => !process.env[k]?.trim());
if (faltan.length) {
  console.error(`Faltan variables en .env: ${faltan.join(", ")} (copia .env.example como .env y completalo).`);
  process.exit(1);
}
const RPC_URL = process.env.RPC_URL!;

// 1. LLM: servidor compatible con Chat Completions (LM Studio por defecto)
const llm = new ChatOpenAI({
  modelName: process.env.LLM_MODEL!,
  configuration: { baseURL: process.env.LLM_BASE_URL!, apiKey: process.env.LLM_API_KEY || "lm-studio" },
  temperature: 0,
  maxRetries: 2,
});

// 2. Identidad EFIMERA solo para inicializar el kit: sin fondos, sin llave guardada, nunca firma.
const wallet = new KeypairWallet(Keypair.generate(), RPC_URL);

// 3. SolanaAgentKit + plugin del negocio
const solanaAgent = new SolanaAgentKit(wallet, RPC_URL, {}).use(AdopcionPlugin);

// 4. Herramientas para LangChain
const tools = createLangchainTools(solanaAgent, solanaAgent.actions);
console.log("Actions registradas:", solanaAgent.actions.map((a) => a.name));

// 5. Agente ReAct con memoria de conversacion
const agent = createReactAgent({
  llm,
  tools: tools as any,
  checkpointSaver: new MemorySaver(),
  messageModifier: `Eres un asistente de consulta del refugio de adopcion "Huellitas en Casa" en Solana Devnet.
Respondes SIEMPRE en español.
Eres de SOLO LECTURA: no puedes registrar, aprobar, rechazar ni modificar nada, ni firmar transacciones.
Para cualquier pregunta sobre cifras, mascotas, solicitudes, tasa de adopcion o direcciones DEBES llamar primero a la herramienta ADOPCION_RESUMEN_NEGOCIO.
Nunca inventes ni calcules cifras por tu cuenta: usa exactamente los valores que devuelva la herramienta.
Si la herramienta devuelve existe=false, explica el motivo y NO inventes datos.
Si hay inconsistencias en el resultado, mencionalas.
Si no hay una mascota mas solicitada (o hay empate), dilo tal cual lo indica el resultado.
Si te piden algo que la herramienta no cubre, di claramente que no tienes esa informacion.`,
});

async function chat() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log("Asistente del refugio listo (solo lectura). Escribe 'exit' para salir.\n");
  const threadId = "session-1";
  const preguntar = () => {
    rl.question(">>>> Tu: ", async (input) => {
      if (input.trim().toLowerCase() === "exit") return rl.close();
      try {
        const r = await agent.invoke({ messages: [new HumanMessage(input)] }, { configurable: { thread_id: threadId } });
        console.log(`\nAgente: ${r.messages[r.messages.length - 1].content}\n`);
      } catch (err) {
        console.error("Error:", (err as Error).message);
      }
      preguntar();
    });
  };
  preguntar();
}

chat();
