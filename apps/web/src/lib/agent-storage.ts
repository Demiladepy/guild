import type { SpecialistRole } from "@/lib/agents";

const AGENT_ID_PREFIX = "guild-erc8004-agentId";

export type StoredAgentIdentity = {
  role: SpecialistRole;
  agentId: string;
  ownerAddress: `0x${string}`;
  registrationTxHash?: string;
};

function storageKey(role: SpecialistRole, ownerAddress: string) {
  return `${AGENT_ID_PREFIX}:${role}:${ownerAddress.toLowerCase()}`;
}

export function loadAgentIdentity(
  role: SpecialistRole,
  ownerAddress: `0x${string}`,
): StoredAgentIdentity | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(storageKey(role, ownerAddress));
  if (!raw) return null;
  return JSON.parse(raw) as StoredAgentIdentity;
}

export function saveAgentIdentity(identity: StoredAgentIdentity) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    storageKey(identity.role, identity.ownerAddress),
    JSON.stringify(identity),
  );
}
