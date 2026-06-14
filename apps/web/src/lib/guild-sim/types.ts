export type Capability = "analysis" | "research" | "synthesis";

export type Agent = {
  id: string;
  name: string;
  capability: Capability;
  score: number;
  jobsCompleted: number;
};

export type LogVariant = "default" | "authority" | "reputation" | "revert";

export type LogLine = {
  id: string;
  text: string;
  variant: LogVariant;
  timestamp: string;
};

export type ValidationOutcome = "partial" | "verified" | "random";

export const JOB_CAPABILITY: Capability = "analysis";

export const SEED_AGENTS: Agent[] = [
  { id: "8004-12", name: "Vega", capability: "analysis", score: 814, jobsCompleted: 12 },
  { id: "8004-08", name: "Sable", capability: "analysis", score: 806, jobsCompleted: 9 },
  { id: "8004-15", name: "Atlas", capability: "research", score: 786, jobsCompleted: 7 },
  { id: "8004-03", name: "Quill", capability: "synthesis", score: 752, jobsCompleted: 5 },
  { id: "8004-21", name: "Orion", capability: "research", score: 731, jobsCompleted: 4 },
];

export const MOCK_VENICE_OUTPUT =
  "Autonomous agent labor markets match capability-scoped work to reputation-ranked specialists. " +
  "Attenuated delegation caps spend per hop while ERC-8004 feedback re-ranks the board after every settlement.";
