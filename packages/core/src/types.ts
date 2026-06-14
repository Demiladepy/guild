export type AgentRole = "orchestrator" | "worker" | "reviewer";

export interface Agent {
  id: string;
  role: AgentRole;
  address: `0x${string}`;
}

export interface Delegation {
  delegator: `0x${string}`;
  delegate: `0x${string}`;
  scope: string;
  caveats: string[];
}

export type JobStatus = "pending" | "active" | "completed" | "failed";

export interface Job {
  id: string;
  prompt: string;
  budget: bigint;
  status: JobStatus;
}
