import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { Keypair } from "@solana/web3.js";
import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage } from "@langchain/core/messages";
import { SolanaAgentKit, KeypairWallet, createLangchainTools } from "solana-agent-kit";
import AdopcionPlugin from "../src/plugins/adopcion";
import { escenario, levantarRpc } from "./helpers";

/** Modelo simulado compatible con Chat Completions: 1) pide la tool, 2) responde con lo que devolvio la tool. */
async function levantarLlm() {
  const vistos: any[] = [];
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const r = JSON.parse(body);
      vistos.push(r);
      const msgs: any[] = r.messages;
      const ultimaTool = [...msgs].reverse().find((m) => m.role === "tool");
      const message = ultimaTool
        ? { role: "assistant", content: `RESPUESTA: ${JSON.parse(ultimaTool.content).result.total_mascotas} mascotas` }
        : { role: "assistant", content: null, tool_calls: [{ id: "c1", type: "function", function: { name: r.tools[0].function.name, arguments: "{}" } }] };
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ id: "chatcmpl-" + vistos.length, object: "chat.completion", created: 1, model: "mock", choices: [{ index: 0, message, finish_reason: ultimaTool ? "stop" : "tool_calls" }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }));
    });
  });
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
  return { url: `http://127.0.0.1:${(server.address() as any).port}/v1`, vistos, cerrar: () => { server.close(); server.closeAllConnections(); } };
}

test("agente ReAct: el modelo llama a la action y la respuesta usa los datos de Devnet simulado", async () => {
  const d = await escenario();
  const rpc = await levantarRpc(d);
  const llmSrv = await levantarLlm();
  process.env.OWNER = d.autoridad.toBase58();
  try {
    const kit = new SolanaAgentKit(new KeypairWallet(Keypair.generate(), rpc.url), rpc.url, {}).use(AdopcionPlugin);
    const tools = createLangchainTools(kit, kit.actions);
    assert.deepEqual(tools.map((t: any) => t.name), ["ADOPCION_RESUMEN_NEGOCIO"]);
    const llm = new ChatOpenAI({ modelName: "mock", configuration: { baseURL: llmSrv.url, apiKey: "x" }, temperature: 0, maxRetries: 0 });
    const agent = createReactAgent({ llm, tools: tools as any });
    const r = await agent.invoke({ messages: [new HumanMessage("¿Cuantas mascotas hay?")] });
    assert.equal(r.messages[r.messages.length - 1].content, "RESPUESTA: 3 mascotas");
    assert.equal(llmSrv.vistos.length, 2);
  } finally {
    delete process.env.OWNER;
    llmSrv.cerrar();
    await rpc.cerrar();
  }
});
