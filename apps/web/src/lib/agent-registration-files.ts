import { addresses, chainId } from "@guild/core/config";
import { agentRegistryUri } from "@guild/core/identity";
import {
  GUILD_AGENT_DEFINITIONS,
  VENICE_CAPABILITY,
  type SpecialistRole,
} from "@/lib/agents";

export function buildAgentRegistrationFile(role: SpecialistRole) {
  const def = GUILD_AGENT_DEFINITIONS[role];

  return {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: `Guild ${def.name}`,
    description: def.description,
    image: null,
    services: [
      {
        name: VENICE_CAPABILITY,
        endpoint: "/api/x402/venice-inference",
      },
    ],
    registrations: [],
    supportedTrust: ["reputation"],
    capabilities: [...def.capabilities],
    role: def.role,
    agentRegistry: agentRegistryUri(chainId, addresses.identityRegistry),
  };
}
