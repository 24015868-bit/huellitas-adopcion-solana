import React from "react";
import ReactDOM from "react-dom/client";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import "@solana/wallet-adapter-react-ui/styles.css";
import App from "./App";
import "./styles.css";

// Cast por conflicto de versiones de @types/react en las librerias de wallet-adapter
const Conexion = ConnectionProvider as any;
const Billeteras = WalletProvider as any;
const Modal = WalletModalProvider as any;
const RPC = "https://api.devnet.solana.com";
const wallets = [new PhantomWalletAdapter(), new SolflareWalletAdapter()];

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Conexion endpoint={RPC}>
      <Billeteras wallets={wallets} autoConnect>
        <Modal>
          <App />
        </Modal>
      </Billeteras>
    </Conexion>
  </React.StrictMode>
);
