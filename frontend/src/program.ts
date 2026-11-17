import { AnchorProvider, Program, type Idl } from "@coral-xyz/anchor";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey } from "@solana/web3.js";
// Se genera con `anchor build` y se copia con `npm run sync-idl` (en la raíz del repo).
import idl from "./idl/adopcion.json";

export const PROGRAM_ID = new PublicKey((idl as { address: string }).address);

export function getProgram(connection: Connection, wallet: AnchorWallet): any {
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  return new Program(idl as Idl, provider);
}

export const pdaRefugio = (autoridad: PublicKey) =>
  PublicKey.findProgramAddressSync([Buffer.from("refugio"), autoridad.toBuffer()], PROGRAM_ID)[0];

export const pdaMascota = (refugio: PublicKey, id: number) => {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(id);
  return PublicKey.findProgramAddressSync([Buffer.from("mascota"), refugio.toBuffer(), b], PROGRAM_ID)[0];
};

export const pdaSolicitud = (mascota: PublicKey, adoptante: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("solicitud"), mascota.toBuffer(), adoptante.toBuffer()],
    PROGRAM_ID
  )[0];

/** Convierte errores de Anchor/wallet en un mensaje legible para la interfaz. */
export function mensajeError(e: unknown): string {
  const err = e as any;
  if (err?.error?.errorMessage) return err.error.errorMessage; // error del programa (#[msg])
  const msg: string = err?.message ?? String(e);
  if (/User rejected|rejected the request/i.test(msg)) return "Cancelaste la firma en la wallet.";
  if (/already in use/i.test(msg)) return "Esa cuenta ya existe (¿solicitud o refugio duplicado?).";
  if (/insufficient/i.test(msg)) return "Saldo insuficiente en Devnet. Pide un airdrop.";
  return msg;
}

export const explorerTx = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
