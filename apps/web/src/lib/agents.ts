import { privateKeyToAccount } from "viem/accounts";

/** Job capability tag used for reputation queries and hiring. */
export const VENICE_CAPABILITY = "venice-inference" as const;

/** Reputation registry tags — tag1 broad, tag2 capability-scoped. */
export const REPUTATION_TAG1 = "guild" as const;

/** Specialist roles registered as ERC-8004 identities. */
export type SpecialistRole = "researcher" | "analyst" | "writer";

export type GuildAgentDefinition = {
  role: SpecialistRole;
  name: string;
  description: string;
  capabilities: readonly string[];
  /** Seed reputation (0–100) — must differ across agents for meaningful run-1 ranking. */
  seedScore: number;
};

const RESEARCHER_SEED_KEY =
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78627d" as const;

const ANALYST_SEED_KEY =
  "0x5de4111afa1a4b94908f83103eb1f96bd9bdbf459de6aa9350166566129f7c5a" as const;

const WRITER_SEED_KEY =
  "0x47e179ec197488593b187fd192a05fc657a282424667ef8d97bc6da81a30ffa0" as const;

const SEED_KEYS: Record<SpecialistRole, `0x${string}`> = {
  researcher: RESEARCHER_SEED_KEY,
  analyst: ANALYST_SEED_KEY,
  writer: WRITER_SEED_KEY,
};

/**
 * Deliberately uneven seeds so run 1 hires Researcher (84).
 * After run-1 downgrade feedback (~40), Analyst (77) overtakes for run 2.
 */
export const GUILD_AGENT_DEFINITIONS: Record<SpecialistRole, GuildAgentDefinition> =
  {
    researcher: {
      role: "researcher",
      name: "Researcher",
      description: "Deep Venice inference for structured research tasks.",
      capabilities: [VENICE_CAPABILITY],
      seedScore: 84,
    },
    analyst: {
      role: "analyst",
      name: "Analyst",
      description: "Quantitative Venice inference and structured analysis.",
      capabilities: [VENICE_CAPABILITY],
      seedScore: 77,
    },
    writer: {
      role: "writer",
      name: "Writer",
      description: "Venice prose specialist for concise copy and summaries.",
      capabilities: [VENICE_CAPABILITY],
      seedScore: 71,
    },
  };

/** Post-settlement score on first run — pulls leader below runner-up. */
export const FIRST_RUN_FEEDBACK_SCORE = 40;

/** Post-settlement score on later runs — rewards good delivery. */
export const LATER_RUN_FEEDBACK_SCORE = 92;

export function getSpecialistAccount(role: SpecialistRole) {
  return privateKeyToAccount(SEED_KEYS[role]);
}

export function getAllSpecialistRoles(): SpecialistRole[] {
  return ["researcher", "analyst", "writer"];
}

export function getAgentRegistrationUrl(role: SpecialistRole): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    (typeof window !== "undefined" ? window.location.origin : "");
  if (!base) {
    throw new Error("Set NEXT_PUBLIC_APP_URL for ERC-8004 registration files");
  }
  return `${base.replace(/\/$/, "")}/api/agents/${role}/registration`;
}
