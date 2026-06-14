"use client";

import { AgentRow } from "@/components/guild/AgentRow";
import { useFlipList } from "@/hooks/useFlipList";
import type { Agent, Capability } from "@/lib/guild-sim/types";
import { JOB_CAPABILITY } from "@/lib/guild-sim/types";
import type { ScoreDeltaFlash } from "@/hooks/useGuildSim";

type StandingsProps = {
  agents: Agent[];
  hiredId: string | null;
  eligibleCount: number;
  scoreDeltaFlash: ScoreDeltaFlash;
  displayScore: (agent: Agent) => number;
  selectedAgentId: string | null;
  onSelectAgent: (id: string) => void;
};

export function Standings({
  agents,
  hiredId,
  eligibleCount,
  scoreDeltaFlash,
  displayScore,
  selectedAgentId,
  onSelectAgent,
}: StandingsProps) {
  const setRef = useFlipList(agents);

  return (
    <section className="guild-card">
      <div style={{ marginBottom: "1rem" }}>
        <h2>Standings — hired by reputation</h2>
        <p className="guild-muted" style={{ margin: "0.25rem 0 0", fontSize: "0.875rem" }}>
          ERC-8004 registry
        </p>
      </div>

      <div className="guild-standings__job">
        <p className="guild-text" style={{ margin: 0, fontSize: "0.875rem", fontWeight: 500 }}>
          Open job · capability:{" "}
          <span style={{ color: "var(--guild-primary)" }}>
            {JOB_CAPABILITY.toUpperCase()}
          </span>
        </p>
        <p className="guild-muted" style={{ margin: "0.25rem 0 0", fontSize: "0.75rem" }}>
          eligible: {eligibleCount} agents
        </p>
      </div>

      <ul className="guild-list" aria-label="Agent standings">
        {agents.map((agent, index) => (
          <AgentRow
            key={agent.id}
            rank={index + 1}
            name={agent.name}
            agentId={agent.id}
            jobsCompleted={agent.jobsCompleted}
            capability={agent.capability as Capability}
            score={displayScore(agent)}
            eligible={agent.capability === JOB_CAPABILITY}
            hired={agent.id === hiredId}
            selected={agent.id === selectedAgentId}
            onChain={agent.onChain}
            explorerUrl={agent.explorerUrl}
            deltaFlash={
              scoreDeltaFlash?.agentId === agent.id
                ? scoreDeltaFlash.delta
                : null
            }
            rowRef={setRef(agent.id)}
            onSelect={() => onSelectAgent(agent.id)}
          />
        ))}
      </ul>
    </section>
  );
}
