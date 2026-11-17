import { useCallback, useEffect, useMemo, useState } from "react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey } from "@solana/web3.js";
import { explorerTx, getProgram, mensajeError, pdaMascota, pdaRefugio, pdaSolicitud, PROGRAM_ID } from "./program";

type MascotaRow = { pubkey: PublicKey; account: any };
type SolicitudRow = { pubkey: PublicKey; account: any };

const etiqueta = (o: object) => Object.keys(o)[0];

export default function App() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const program = useMemo(() => (wallet ? getProgram(connection, wallet) : null), [connection, wallet]);

  const [refugio, setRefugio] = useState<any | null>(null);
  const [mascotas, setMascotas] = useState<MascotaRow[]>([]);
  const [solicitudes, setSolicitudes] = useState<SolicitudRow[]>([]);
  const [estado, setEstado] = useState<{ tipo: "ok" | "error" | "info"; texto: string; tx?: string } | null>(null);
  const [cargando, setCargando] = useState(false);

  // formularios
  const [nombreRefugio, setNombreRefugio] = useState("Huellitas en Casa");
  const [nombre, setNombre] = useState("");
  const [especie, setEspecie] = useState<"perro" | "gato">("perro");
  const [edad, setEdad] = useState(12);
  const [mensaje, setMensaje] = useState("");
  const [refugioAjeno, setRefugioAjeno] = useState("");

  const miRefugioPda = wallet ? pdaRefugio(wallet.publicKey) : null;

  const refrescar = useCallback(async () => {
    if (!program || !wallet) return;
    const [r] = await program.account.refugio.fetchMultiple([pdaRefugio(wallet.publicKey)]);
    setRefugio(r ?? null);
    // Anchor devuelve { publicKey, account }; lo normalizamos a { pubkey, account }
    const aFila = (r: any) => ({ pubkey: r.publicKey as PublicKey, account: r.account });
    setMascotas((await program.account.mascota.all()).map(aFila));
    setSolicitudes((await program.account.solicitud.all()).map(aFila));
  }, [program, wallet]);

  useEffect(() => {
    refrescar().catch((e) => setEstado({ tipo: "error", texto: mensajeError(e) }));
  }, [refrescar]);

  // Ejecuta una operación: firma, espera confirmación, refresca datos y muestra el resultado.
  async function ejecutar(descripcion: string, fn: () => Promise<string>) {
    setCargando(true);
    setEstado({ tipo: "info", texto: `${descripcion}… confirma en tu wallet` });
    try {
      const sig = await fn();
      setEstado({ tipo: "ok", texto: `${descripcion}: listo`, tx: sig });
      await refrescar();
    } catch (e) {
      // Devnet a veces tarda más de 30 s en confirmar: la transacción puede haberse
      // ejecutado igual. En ese caso seguimos consultando la firma en vez de mostrar error.
      const msg: string = (e as any)?.message ?? "";
      const m = /signature\s+([1-9A-HJ-NP-Za-km-z]{80,90})/.exec(msg);
      if (/not confirmed in/i.test(msg) && m) {
        const sig = m[1];
        setEstado({ tipo: "info", texto: `${descripcion}: esperando confirmación de la red…`, tx: sig });
        try {
          await esperarFirma(sig);
          setEstado({ tipo: "ok", texto: `${descripcion}: listo`, tx: sig });
          await refrescar();
        } catch (e2) {
          setEstado({ tipo: "error", texto: mensajeError(e2), tx: sig });
        }
      } else {
        setEstado({ tipo: "error", texto: mensajeError(e) });
      }
    } finally {
      setCargando(false);
    }
  }

  // Consulta el estado de una firma hasta ~60 s; lanza error si la red la rechazó.
  async function esperarFirma(sig: string) {
    for (let i = 0; i < 30; i++) {
      const { value } = await connection.getSignatureStatus(sig, { searchTransactionHistory: true });
      if (value) {
        if (value.err) throw new Error("La transacción falló en la red: " + JSON.stringify(value.err));
        if (value.confirmationStatus === "confirmed" || value.confirmationStatus === "finalized") return;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    throw new Error("Sigue sin confirmarse. Revisa la firma en el Explorer.");
  }

  const crearRefugio = () =>
    ejecutar("Crear refugio", () =>
      program!.methods.crearRefugio(nombreRefugio).accountsPartial({ refugio: miRefugioPda!, autoridad: wallet!.publicKey }).rpc()
    );

  const registrarMascota = () =>
    ejecutar("Registrar mascota", () =>
      program!.methods
        .registrarMascota(nombre, especie === "perro" ? { perro: {} } : { gato: {} }, edad)
        .accountsPartial({
          refugio: miRefugioPda!,
          mascota: pdaMascota(miRefugioPda!, refugio.totalMascotas),
          autoridad: wallet!.publicKey,
        })
        .rpc()
    );

  const solicitar = (m: MascotaRow) =>
    ejecutar(`Solicitar adopción de ${m.account.nombre}`, () =>
      program!.methods
        .solicitarAdopcion(mensaje)
        .accountsPartial({
          mascota: m.pubkey,
          solicitud: pdaSolicitud(m.pubkey, wallet!.publicKey),
          adoptante: wallet!.publicKey,
        })
        .rpc()
    );

  const resolver = (s: SolicitudRow, aprobar: boolean) =>
    ejecutar(aprobar ? "Aprobar solicitud" : "Rechazar solicitud", () =>
      program!.methods
        .resolverSolicitud(aprobar)
        .accountsPartial({
          refugio: miRefugioPda!,
          mascota: s.account.mascota,
          solicitud: s.pubkey,
          autoridad: wallet!.publicKey,
        })
        .rpc()
    );

  const cerrarSolicitud = (s: SolicitudRow) =>
    ejecutar("Cerrar solicitud", () =>
      program!.methods.cerrarSolicitud().accountsPartial({ solicitud: s.pubkey, adoptante: wallet!.publicKey }).rpc()
    );

  const darDeBaja = (m: MascotaRow) =>
    ejecutar(`Dar de baja a ${m.account.nombre}`, () =>
      program!.methods
        .darDeBajaMascota()
        .accountsPartial({ refugio: miRefugioPda!, mascota: m.pubkey, autoridad: wallet!.publicKey })
        .rpc()
    );

  const esMia = (m: MascotaRow) => miRefugioPda && m.account.refugio.equals(miRefugioPda);
  const misSolicitudesRefugio = solicitudes.filter((s) =>
    mascotas.some((m) => m.pubkey.equals(s.account.mascota) && esMia(m))
  );
  const mascotasVisibles = refugioAjeno
    ? mascotas.filter((m) => m.account.refugio.toBase58() === refugioAjeno.trim())
    : mascotas;

  return (
    <main>
      <header>
        <div>
          <h1>🐾 Huellitas en Casa</h1>
          <p className="sub">Portal de adopción de perros y gatos · Solana Devnet</p>
        </div>
        <WalletMultiButton />
      </header>

      {estado && (
        <div className={`aviso ${estado.tipo}`}>
          {estado.texto}{" "}
          {estado.tx && (
            <a href={explorerTx(estado.tx)} target="_blank" rel="noreferrer">
              ver transacción ↗
            </a>
          )}
        </div>
      )}

      {!wallet && <p className="vacio">Conecta tu wallet (Phantom o Solflare en Devnet) para comenzar.</p>}

      {wallet && (
        <>
          <section>
            <h2>Mi refugio</h2>
            {refugio ? (
              <p>
                <strong>{refugio.nombre}</strong> · {refugio.mascotasActivas} mascotas activas ·{" "}
                {refugio.totalAdopciones} adopciones
              </p>
            ) : (
              <div className="fila">
                <input value={nombreRefugio} onChange={(e) => setNombreRefugio(e.target.value)} maxLength={32} />
                <button disabled={cargando || !nombreRefugio} onClick={crearRefugio}>
                  Crear refugio
                </button>
              </div>
            )}
          </section>

          {refugio && (
            <section>
              <h2>Registrar mascota</h2>
              <div className="fila">
                <input placeholder="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={32} />
                <select value={especie} onChange={(e) => setEspecie(e.target.value as "perro" | "gato")}>
                  <option value="perro">Perro</option>
                  <option value="gato">Gato</option>
                </select>
                <input type="number" min={0} value={edad} onChange={(e) => setEdad(Number(e.target.value))} />
                <span className="sub">meses</span>
                <button disabled={cargando || !nombre} onClick={registrarMascota}>
                  Registrar
                </button>
              </div>
            </section>
          )}

          <section>
            <h2>Mascotas en adopción</h2>
            <div className="fila">
              <input
                placeholder="Filtrar por dirección de refugio (opcional)"
                value={refugioAjeno}
                onChange={(e) => setRefugioAjeno(e.target.value)}
                style={{ flex: 1 }}
              />
              <input
                placeholder="Mensaje para el refugio (opcional)"
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                maxLength={140}
                style={{ flex: 1 }}
              />
            </div>
            {mascotasVisibles.length === 0 && <p className="vacio">Aún no hay mascotas registradas.</p>}
            <div className="grid">
              {mascotasVisibles.map((m) => (
                <article key={m.pubkey.toBase58()} className="card">
                  <h3>
                    {etiqueta(m.account.especie) === "perro" ? "🐶" : "🐱"} {m.account.nombre}
                  </h3>
                  <p className="sub">
                    {m.account.edadMeses} meses · {etiqueta(m.account.estado)}
                    {m.account.solicitudesPendientes > 0 && ` · ${m.account.solicitudesPendientes} solicitud(es)`}
                  </p>
                  {etiqueta(m.account.estado) === "disponible" && !esMia(m) && (
                    <button disabled={cargando} onClick={() => solicitar(m)}>
                      Quiero adoptar
                    </button>
                  )}
                  {esMia(m) && (
                    <button className="peligro" disabled={cargando} onClick={() => darDeBaja(m)}>
                      Dar de baja
                    </button>
                  )}
                </article>
              ))}
            </div>
          </section>

          {misSolicitudesRefugio.length > 0 && (
            <section>
              <h2>Solicitudes recibidas (mi refugio)</h2>
              {misSolicitudesRefugio.map((s) => (
                <div key={s.pubkey.toBase58()} className="fila item">
                  <span>
                    <code>{s.account.adoptante.toBase58().slice(0, 8)}…</code> · “{s.account.mensaje}” ·{" "}
                    <b>{etiqueta(s.account.estado)}</b>
                  </span>
                  {etiqueta(s.account.estado) === "pendiente" && (
                    <>
                      <button disabled={cargando} onClick={() => resolver(s, true)}>
                        Aprobar
                      </button>
                      <button className="peligro" disabled={cargando} onClick={() => resolver(s, false)}>
                        Rechazar
                      </button>
                    </>
                  )}
                </div>
              ))}
            </section>
          )}

          <section>
            <h2>Mis solicitudes</h2>
            {solicitudes.filter((s) => s.account.adoptante.equals(wallet.publicKey)).length === 0 && (
              <p className="vacio">No has enviado solicitudes.</p>
            )}
            {solicitudes
              .filter((s) => s.account.adoptante.equals(wallet.publicKey))
              .map((s) => (
                <div key={s.pubkey.toBase58()} className="fila item">
                  <span>
                    Mascota <code>{s.account.mascota.toBase58().slice(0, 8)}…</code> · <b>{etiqueta(s.account.estado)}</b>
                  </span>
                  <button disabled={cargando || etiqueta(s.account.estado) === "pendiente"} onClick={() => cerrarSolicitud(s)}>
                    Cerrar y recuperar renta
                  </button>
                </div>
              ))}
          </section>
        </>
      )}

      <footer>
        Program ID: <code>{PROGRAM_ID.toBase58()}</code>
      </footer>
    </main>
  );
}
