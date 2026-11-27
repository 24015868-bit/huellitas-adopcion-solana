import { AnchorProvider, Program, Wallet, type Idl } from "@coral-xyz/anchor";
import { Connection, Keypair } from "@solana/web3.js";
import { cargarIdl } from "./idl";

/**
 * Cliente de SOLO LECTURA sobre el RPC del agente. La wallet es una identidad efimera en memoria,
 * sin fondos y que nunca firma: las lecturas no requieren firmar transacciones.
 */
export function crearProgramaSoloLectura(rpcUrl: string, idl: any = cargarIdl()): Program<Idl> {
  const provider = new AnchorProvider(new Connection(rpcUrl, "confirmed"), new Wallet(Keypair.generate()), {
    commitment: "confirmed",
  });
  return new Program(idl as Idl, provider);
}
