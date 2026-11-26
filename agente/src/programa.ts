import { AnchorProvider, Program, Wallet, type Idl } from "@coral-xyz/anchor";
import { Connection, Keypair } from "@solana/web3.js";
import { cargarIdl } from "./idl";

/**
 * Cliente de SOLO LECTURA: usa una wallet efimera sin fondos que nunca firma nada.
 * Asi el agente no necesita (ni recibe) ninguna llave privada.
 */
export function crearProgramaSoloLectura(rpcUrl: string, idl: any = cargarIdl()): Program<Idl> {
  const connection = new Connection(rpcUrl, "confirmed");
  const provider = new AnchorProvider(connection, new Wallet(Keypair.generate()), { commitment: "confirmed" });
  return new Program(idl as Idl, provider);
}
