import "dotenv/config";
import { Keypair } from "@solana/web3.js";
import { SolanaAgentKit, KeypairWallet } from "solana-agent-kit";
import AdopcionPlugin from "./plugins/adopcion";
import AdopcionResumenNegocioAction from "./plugins/adopcion/actions/resumenNegocio";

/**
 * Prueba DIRECTA, sin modelo de lenguaje: ejecuta la action (handler -> tool) y muestra el JSON.
 * Estas cifras son la referencia contra la que se contrastan las respuestas del asistente con IA.
 */
const RPC_URL = process.env.RPC_URL || "https://api.devnet.solana.com";
const agent = new SolanaAgentKit(new KeypairWallet(Keypair.generate(), RPC_URL), RPC_URL, {}).use(AdopcionPlugin);

const salida = await AdopcionResumenNegocioAction.handler(agent, {});
console.log(JSON.stringify(salida, null, 2));
if (salida.status !== "success") process.exitCode = 1;
