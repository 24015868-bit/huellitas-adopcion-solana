import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";
import { Adopcion } from "../target/types/adopcion";

describe("adopcion — portal de adopción (Huellitas en Casa)", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Adopcion as Program<Adopcion>;

  const refugioAuth = Keypair.generate(); // autoridad del refugio
  const adoptante1 = Keypair.generate();
  const adoptante2 = Keypair.generate();
  const intruso = Keypair.generate();

  const [refugioPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("refugio"), refugioAuth.publicKey.toBuffer()],
    program.programId
  );
  const mascotaPda = (id: number) => {
    const idBuf = Buffer.alloc(4);
    idBuf.writeUInt32LE(id);
    return PublicKey.findProgramAddressSync(
      [Buffer.from("mascota"), refugioPda.toBuffer(), idBuf],
      program.programId
    )[0];
  };
  const solicitudPda = (mascota: PublicKey, adoptante: PublicKey) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("solicitud"), mascota.toBuffer(), adoptante.toBuffer()],
      program.programId
    )[0];

  // Verifica que una promesa falle con un código de error de Anchor concreto.
  // Acepta uno o varios códigos válidos (Anchor puede fallar primero por seeds o por has_one).
  async function esperarError(p: Promise<unknown>, codigos: string | string[]) {
    const lista = Array.isArray(codigos) ? codigos : [codigos];
    try {
      await p;
    } catch (e: any) {
      const texto = `${e?.error?.errorCode?.code ?? ""} ${e?.message ?? ""} ${(e?.logs ?? []).join(" ")}`;
      assert.isTrue(
        lista.some((c) => texto.includes(c)),
        `se esperaba ${lista.join(" o ")}, llegó: ${texto}`
      );
      return;
    }
    assert.fail(`la transacción debió fallar con ${lista.join(" o ")}`);
  }

  before(async () => {
    for (const kp of [refugioAuth, adoptante1, adoptante2, intruso]) {
      const sig = await provider.connection.requestAirdrop(kp.publicKey, 2 * LAMPORTS_PER_SOL);
      await provider.connection.confirmTransaction(sig, "confirmed");
    }
  });

  // ---------------------------------------------------------------- VÁLIDOS

  it("V1 crea el refugio (Registro)", async () => {
    const sig = await program.methods
      .crearRefugio("Huellitas en Casa")
      .accountsPartial({ refugio: refugioPda, autoridad: refugioAuth.publicKey })
      .signers([refugioAuth])
      .rpc();
    console.log("    tx crear_refugio:", sig);
    const r = await program.account.refugio.fetch(refugioPda);
    assert.equal(r.nombre, "Huellitas en Casa");
    assert.equal(r.totalMascotas, 0);
    assert.ok(r.autoridad.equals(refugioAuth.publicKey));
  });

  it("V2 registra dos mascotas con PDAs distintas (Cliente)", async () => {
    for (const [nombre, especie, edad] of [
      ["Firulais", { perro: {} }, 24],
      ["Michi", { gato: {} }, 8],
    ] as const) {
      const r = await program.account.refugio.fetch(refugioPda);
      await program.methods
        .registrarMascota(nombre, especie as any, edad)
        .accountsPartial({
          refugio: refugioPda,
          mascota: mascotaPda(r.totalMascotas),
          autoridad: refugioAuth.publicKey,
        })
        .signers([refugioAuth])
        .rpc();
    }
    const r = await program.account.refugio.fetch(refugioPda);
    assert.equal(r.totalMascotas, 2);
    assert.equal(r.mascotasActivas, 2);
    const m0 = await program.account.mascota.fetch(mascotaPda(0));
    assert.equal(m0.nombre, "Firulais");
    assert.deepEqual(m0.estado, { disponible: {} });
  });

  it("V3 modifica una mascota (lectura + modificación)", async () => {
    await program.methods
      .actualizarMascota("Firulais Jr.", 30)
      .accountsPartial({
        refugio: refugioPda,
        mascota: mascotaPda(0),
        autoridad: refugioAuth.publicKey,
      })
      .signers([refugioAuth])
      .rpc();
    const m = await program.account.mascota.fetch(mascotaPda(0));
    assert.equal(m.nombre, "Firulais Jr.");
    assert.equal(m.edadMeses, 30);
  });

  it("V4 un adoptante solicita adoptar (Venta)", async () => {
    const mascota = mascotaPda(0);
    const solicitud = solicitudPda(mascota, adoptante1.publicKey);
    const sig = await program.methods
      .solicitarAdopcion("Tengo patio y mucho cariño")
      .accountsPartial({ mascota, solicitud, adoptante: adoptante1.publicKey })
      .signers([adoptante1])
      .rpc();
    console.log("    tx solicitar_adopcion:", sig);
    const s = await program.account.solicitud.fetch(solicitud);
    assert.deepEqual(s.estado, { pendiente: {} });
    const m = await program.account.mascota.fetch(mascota);
    assert.equal(m.solicitudesPendientes, 1);
  });

  // ---------------------------------------------------------------- RECHAZOS

  it("R1 rechaza editar una mascota sin ser la autoridad", async () => {
    await esperarError(
      program.methods
        .actualizarMascota("Hackeado", null)
        .accountsPartial({
          refugio: refugioPda,
          mascota: mascotaPda(0),
          autoridad: intruso.publicKey,
        })
        .signers([intruso])
        .rpc(),
      ["ConstraintSeeds", "NoAutorizado"] // la PDA del refugio no coincide con el intruso
    );
  });

  it("R2 rechaza dar de baja con solicitudes pendientes", async () => {
    await esperarError(
      program.methods
        .darDeBajaMascota()
        .accountsPartial({
          refugio: refugioPda,
          mascota: mascotaPda(0),
          autoridad: refugioAuth.publicKey,
        })
        .signers([refugioAuth])
        .rpc(),
      "TieneSolicitudesPendientes"
    );
  });

  it("R3 rechaza cerrar una solicitud que sigue pendiente", async () => {
    const mascota = mascotaPda(0);
    await esperarError(
      program.methods
        .cerrarSolicitud()
        .accountsPartial({
          solicitud: solicitudPda(mascota, adoptante1.publicKey),
          adoptante: adoptante1.publicKey,
        })
        .signers([adoptante1])
        .rpc(),
      "SolicitudPendiente"
    );
  });

  it("R4 rechaza que un intruso resuelva solicitudes", async () => {
    const mascota = mascotaPda(0);
    await esperarError(
      program.methods
        .resolverSolicitud(true)
        .accountsPartial({
          refugio: refugioPda,
          mascota,
          solicitud: solicitudPda(mascota, adoptante1.publicKey),
          autoridad: intruso.publicKey,
        })
        .signers([intruso])
        .rpc(),
      ["ConstraintSeeds", "NoAutorizado"]
    );
  });

  // ------------------------------------------------- FLUJO COMPLETO + CIERRE

  it("V5 aprueba la solicitud: la mascota queda adoptada", async () => {
    const mascota = mascotaPda(0);
    // segundo adoptante también solicita (quedará pendiente hasta que se rechace)
    const solicitud2 = solicitudPda(mascota, adoptante2.publicKey);
    await program.methods
      .solicitarAdopcion("Yo también quiero")
      .accountsPartial({ mascota, solicitud: solicitud2, adoptante: adoptante2.publicKey })
      .signers([adoptante2])
      .rpc();

    const sig = await program.methods
      .resolverSolicitud(true)
      .accountsPartial({
        refugio: refugioPda,
        mascota,
        solicitud: solicitudPda(mascota, adoptante1.publicKey),
        autoridad: refugioAuth.publicKey,
      })
      .signers([refugioAuth])
      .rpc();
    console.log("    tx resolver_solicitud (aprobar):", sig);

    const m = await program.account.mascota.fetch(mascota);
    assert.deepEqual(m.estado, { adoptada: {} });
    assert.ok(m.adoptante!.equals(adoptante1.publicKey));
    assert.equal(m.solicitudesPendientes, 1);
    const r = await program.account.refugio.fetch(refugioPda);
    assert.equal(r.totalAdopciones, 1);
  });

  it("R5 rechaza solicitar adopción de una mascota ya adoptada", async () => {
    const mascota = mascotaPda(0);
    await esperarError(
      program.methods
        .solicitarAdopcion("Llegué tarde")
        .accountsPartial({
          mascota,
          solicitud: solicitudPda(mascota, intruso.publicKey),
          adoptante: intruso.publicKey,
        })
        .signers([intruso])
        .rpc(),
      "MascotaNoDisponible"
    );
  });

  it("R6 rechaza resolver dos veces la misma solicitud", async () => {
    const mascota = mascotaPda(0);
    await esperarError(
      program.methods
        .resolverSolicitud(false)
        .accountsPartial({
          refugio: refugioPda,
          mascota,
          solicitud: solicitudPda(mascota, adoptante1.publicKey),
          autoridad: refugioAuth.publicKey,
        })
        .signers([refugioAuth])
        .rpc(),
      "SolicitudYaResuelta"
    );
  });

  it("V6 rechaza la segunda solicitud y cierra cuentas resueltas", async () => {
    const mascota = mascotaPda(0);
    const sol2 = solicitudPda(mascota, adoptante2.publicKey);
    await program.methods
      .resolverSolicitud(false)
      .accountsPartial({
        refugio: refugioPda,
        mascota,
        solicitud: sol2,
        autoridad: refugioAuth.publicKey,
      })
      .signers([refugioAuth])
      .rpc();

    // El adoptante cierra su solicitud resuelta y recupera la renta
    const antes = await provider.connection.getBalance(adoptante2.publicKey);
    const sigCierre = await program.methods
      .cerrarSolicitud()
      .accountsPartial({ solicitud: sol2, adoptante: adoptante2.publicKey })
      .signers([adoptante2])
      .rpc();
    console.log("    tx cerrar_solicitud:", sigCierre);
    const despues = await provider.connection.getBalance(adoptante2.publicKey);
    assert.isAbove(despues, antes);
    assert.isNull(await provider.connection.getAccountInfo(sol2));
  });

  it("V7 da de baja la mascota sin pendientes (cierre condicionado)", async () => {
    const mascota = mascotaPda(0);
    const sig = await program.methods
      .darDeBajaMascota()
      .accountsPartial({
        refugio: refugioPda,
        mascota,
        autoridad: refugioAuth.publicKey,
      })
      .signers([refugioAuth])
      .rpc();
    console.log("    tx dar_de_baja_mascota:", sig);
    assert.isNull(await provider.connection.getAccountInfo(mascota));
    const r = await program.account.refugio.fetch(refugioPda);
    assert.equal(r.mascotasActivas, 1);
    assert.equal(r.totalMascotas, 2); // el contador no retrocede: ids únicos
  });
});
