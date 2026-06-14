import { addresses, chain, chainId, publicClient } from "@guild/core/config";
import {
  agentRegistryUri,
  readReputationSummary,
  writeAgentFeedback,
} from "@guild/core/identity";
import type { Account, Hash } from "viem";
import {
  FIRST_RUN_FEEDBACK_SCORE,
  GUILD_AGENT_DEFINITIONS,
  LATER_RUN_FEEDBACK_SCORE,
  REPUTATION_TAG1,
  VENICE_CAPABILITY,
  getAgentRegistrationUrl,
  getAllSpecialistRoles,
  getSpecialistAccount,
  type SpecialistRole,
} from "@/lib/agents";
import {
  loadAgentIdentity,
  saveAgentIdentity,
  type StoredAgentIdentity,
} from "@/lib/agent-storage";
import { getOrCreateContractorAccount } from "@/lib/session-account";
import { createContractorWalletClient } from "@/lib/contractor-wallet";
import { formatJobError } from "@/lib/job-errors";

export type RegisteredGuildAgent = StoredAgentIdentity & {
  name: string;
  address: `0x${string}`;
};

async function ensureRegistered(params: {
  account: Account;
  role: SpecialistRole;
}): Promise<RegisteredGuildAgent> {
  const existing = loadAgentIdentity(params.role, params.account.address);
  if (existing) {
    const { readAgentOwner } = await import("@guild/core/identity");
    const owner = await readAgentOwner(BigInt(existing.agentId));
    if (owner.toLowerCase() === params.account.address.toLowerCase()) {
      const def = GUILD_AGENT_DEFINITIONS[params.role];
      return { ...existing, name: def.name, address: params.account.address };
    }
  }

  const { registerAgent } = await import("@guild/core/identity");
  const agentURI = getAgentRegistrationUrl(params.role);
  const { agentId, hash } = await registerAgent({
    account: params.account,
    agentURI,
    chain,
  });

  const identity: StoredAgentIdentity = {
    role: params.role,
    agentId: agentId.toString(),
    ownerAddress: params.account.address,
    registrationTxHash: hash,
  };
  saveAgentIdentity(identity);

  const def = GUILD_AGENT_DEFINITIONS[params.role];
  return { ...identity, name: def.name, address: params.account.address };
}

async function seedSpecialistReputation(params: {
  contractor: Account;
  specialistRole: SpecialistRole;
  specialistAgentId: bigint;
}): Promise<Hash> {
  const def = GUILD_AGENT_DEFINITIONS[params.specialistRole];
  const seedValue = BigInt(Math.round(def.seedScore * 100));
  const feedbackURI = getAgentRegistrationUrl(params.specialistRole);
  const feedbackPayload = JSON.stringify({
    type: "https://eips.ethereum.org/EIPS/eip-8004#feedback-v1",
    agentRegistry: agentRegistryUri(chainId, addresses.identityRegistry),
    agentId: params.specialistAgentId.toString(),
    clientAddress: params.contractor.address,
    createdAt: new Date().toISOString(),
    value: def.seedScore,
    valueDecimals: 2,
    tag1: REPUTATION_TAG1,
    tag2: VENICE_CAPABILITY,
    note: "Guild demo seed reputation",
  });

  return writeAgentFeedback({
    account: params.contractor,
    chain,
    agentId: params.specialistAgentId,
    value: seedValue,
    valueDecimals: 2,
    tag1: REPUTATION_TAG1,
    tag2: VENICE_CAPABILITY,
    endpoint: "/api/x402/venice-inference",
    feedbackURI,
    feedbackPayload,
    client: createContractorWalletClient(),
  });
}

/** Register 3 specialist ERC-8004 identities and seed uneven reputation. */
export async function registerGuildAgents(): Promise<{
  specialists: RegisteredGuildAgent[];
  seedTxHashes: Hash[];
}> {
  const contractorAccount = getOrCreateContractorAccount();
  const specialists: RegisteredGuildAgent[] = [];
  const seedTxHashes: Hash[] = [];

  for (const role of getAllSpecialistRoles()) {
    const account = getSpecialistAccount(role);
    const registered = await ensureRegistered({ account, role });
    specialists.push(registered);

    const summaryKey = `${contractorAccount.address}:${registered.agentId}:seeded`;
    const alreadySeeded =
      typeof window !== "undefined" &&
      (localStorage.getItem(summaryKey) === "1" ||
        (() => {
          const legacy = sessionStorage.getItem(summaryKey);
          if (legacy === "1") {
            localStorage.setItem(summaryKey, "1");
            sessionStorage.removeItem(summaryKey);
            return true;
          }
          return false;
        })());

    if (!alreadySeeded) {
      try {
        const hash = await seedSpecialistReputation({
          contractor: contractorAccount,
          specialistRole: role,
          specialistAgentId: BigInt(registered.agentId),
        });
        await publicClient.waitForTransactionReceipt({ hash });
        seedTxHashes.push(hash);
        localStorage.setItem(summaryKey, "1");
      } catch (err) {
        throw new Error(formatJobError(err, `seed-${role}`));
      }
    }
  }

  return { specialists, seedTxHashes };
}
