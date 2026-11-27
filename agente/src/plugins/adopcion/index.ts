import type { SolanaAgentKit } from "solana-agent-kit";
import { resumenNegocio } from "./tools/resumenNegocio";
import AdopcionResumenNegocioAction from "./actions/resumenNegocio";

/** PLUGIN: agrupa los metodos (tools) y las actions que se registran en el agente. */
const AdopcionPlugin = {
  name: "adopcion",
  methods: { resumenNegocio },
  actions: [AdopcionResumenNegocioAction],
  initialize(agent: SolanaAgentKit) {
    Object.entries(this.methods).forEach(([name, fn]) => {
      if (typeof fn === "function") (this.methods as any)[name] = (fn as any).bind(null, agent);
    });
  },
};

export default AdopcionPlugin;
