import { readReputationSummary } from "@guild/core/identity";
import type { Account } from "viem";
import {
  GUILD_AGENT_DEFINITIONS,
  REPUTATION_TAG1,
  VENICE_CAPABILITY,
  getAllSpecialistRoles,
  getSpecialistAccount,
  type SpecialistRole,
} from "@/lib/agents";
import { loadAgentIdentity } from "@/lib/agent-storage";
import {
  redelegateToSpecialist,
} from "@/lib/delegation-chain";
import type { GetGrantedExecutionPermissionsResult } from "@metamask/smart-accounts-kit/actions";
import type { RedelegatePermissionContextReturnType } from "@metamask/smart-accounts-kit/actions";

type GrantedPermission = GetGrantedExecutionPermissionsResult[number];

export type SpecialistCandidate = {
  role: SpecialistRole;
  name: string;
  address: `0x${string}`;
  agentId: string;
  score: number;
  feedbackCount: bigint;
  capabilities: readonly string[];
};

export async function listSpecialistCandidates(params: {
  contractorAddress: `0x${string}`;
  requiredCapability?: string;
}): Promise<SpecialistCandidate[]> {
  const capability = params.requiredCapability ?? VENICE_CAPABILITY;
  const candidates: SpecialistCandidate[] = [];

  for (const role of getAllSpecialistRoles()) {
    const def = GUILD_AGENT_DEFINITIONS[role];
    if (!def.capabilities.includes(capability)) continue;

    const account = getSpecialistAccount(role);
    const stored = loadAgentIdentity(role, account.address);
    if (!stored) continue;

    const summary = await readReputationSummary({
      agentId: BigInt(stored.agentId),
      clientAddresses: [params.contractorAddress],
      tag1: REPUTATION_TAG1,
      tag2: capability,
    });

    candidates.push({
      role,
      name: def.name,
      address: account.address,
      agentId: stored.agentId,
      score: summary.score,
      feedbackCount: summary.count,
      capabilities: def.capabilities,
    });
  }

  return candidates.sort((a, b) => b.score - a.score);
}

export async function hireTopSpecialist(params: {
  contractorAccount: Account;
  contractorAddress: `0x${string}`;
  parentPermission: GrantedPermission;
  requiredCapability?: string;
}): Promise<{
  hired: SpecialistCandidate;
  candidates: SpecialistCandidate[];
  redelegation: RedelegatePermissionContextReturnType;
}> {
  const candidates = await listSpecialistCandidates({
    contractorAddress: params.contractorAddress,
    requiredCapability: params.requiredCapability,
  });

  if (candidates.length === 0) {
    throw new Error(
      "No registered specialists with reputation data — run Register Agents first",
    );
  }

  const hired = candidates[0]!;
  const redelegation = await redelegateToSpecialist({
    contractorAccount: params.contractorAccount,
    specialistAddress: hired.address,
    parentPermission: params.parentPermission,
  });

  return { hired, candidates, redelegation };
}
