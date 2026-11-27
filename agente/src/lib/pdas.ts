import { PublicKey } from "@solana/web3.js";

/** Mismas semillas que programs/adopcion/src/lib.rs y frontend/src/program.ts. */
export const pdaRefugio = (autoridad: PublicKey, programId: PublicKey) =>
  PublicKey.findProgramAddressSync([Buffer.from("refugio"), autoridad.toBuffer()], programId)[0];

export const pdaMascota = (refugio: PublicKey, id: number, programId: PublicKey) => {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(id);
  return PublicKey.findProgramAddressSync([Buffer.from("mascota"), refugio.toBuffer(), b], programId)[0];
};

export const pdaSolicitud = (mascota: PublicKey, adoptante: PublicKey, programId: PublicKey) =>
  PublicKey.findProgramAddressSync([Buffer.from("solicitud"), mascota.toBuffer(), adoptante.toBuffer()], programId)[0];
