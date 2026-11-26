import "dotenv/config";
import readline from "node:readline/promises";
import { crearProgramaSoloLectura } from "./programa";
import { crearEjecutor } from "./plugins/adopcion";
import { resumenAdopcion } from "./plugins/adopcion/actions/resumenAdopcion";
import { formatearResumen } from "./formato";
import { ejecutarAgente } from "./agente";

const RPC_URL = process.env.RPC_URL?.trim() || "https://api.devnet.solana.com";
const LM_STUDIO_URL = process.env.LM_STUDIO_URL?.trim() || "http://localhost:1234/v1";
const MODEL_NAME = process.env.MODEL_NAME?.trim() || undefined;

const AYUDA = `Asistente Huellitas en Casa (solo lectura, Solana Devnet)

  npm start                       modo interactivo (usa LM Studio)
  npm start -- --pregunta "..."   una sola pregunta
  npm run resumen                 resumen calculado SIN modelo (no requiere LM Studio)
  npm run resumen -- --json       el mismo resumen en JSON
`;

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--ayuda") || args.includes("-h")) return void console.log(AYUDA);

  const program = crearProgramaSoloLectura(RPC_URL);

  if (args.includes("--sin-modelo")) {
    const r = await resumenAdopcion({}, { program });
    console.log(args.includes("--json") ? JSON.stringify(r, null, 2) : formatearResumen(r));
    return;
  }

  const deps = {
    config: { lmUrl: LM_STUDIO_URL, modelo: MODEL_NAME },
    ejecutarHerramienta: crearEjecutor(program),
  };

  const i = args.indexOf("--pregunta");
  if (i >= 0 && args[i + 1]) {
    console.log(await ejecutarAgente(args[i + 1], deps));
    return;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log('Asistente Huellitas en Casa. Escribe tu pregunta o "salir".\nEjemplos: "¿cuántas mascotas hay disponibles?", "¿hay solicitudes pendientes?"\n');
  for (;;) {
    const p = (await rl.question("Pregunta> ")).trim();
    if (!p) continue;
    if (["salir", "exit", "q"].includes(p.toLowerCase())) break;
    try {
      console.log("\n" + (await ejecutarAgente(p, deps)) + "\n");
    } catch (e: any) {
      console.error("\n" + (e?.message ?? e) + "\n");
    }
  }
  rl.close();
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
