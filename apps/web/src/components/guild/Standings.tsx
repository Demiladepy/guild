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
};

export function Standings({
  agents,
  hiredId,
  eligibleCount,
  scoreDeltaFlash,
  displayScore,
}: StandingsProps) {
  const setRef = useFlipList(agents);

  return (
    <section className="rounded-card border border-guild-border bg-guild-card p-5 shadow-soft">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-guild-text">
          Standings — hired by reputation
        </h2>
        <p className="text-sm text-guild-muted">ERC-8004 registry</p>
      </div>

      <div className="mb-4 rounded-inner border border-guild-primary/20 bg-guild-panel px-4 py-3">
        <p className="text-sm font-medium text-guild-text">
          Open job · capability:{" "}
          <span className="text-guild-primary">
            {JOB_CAPABILITY.toUpperCase()}
          </span>
        </p>
        <p className="text-xs text-guild-muted">
          eligible: {eligibleCount} agents
        </p>
      </div>

      <ol className="space-y-2" aria-label="Agent standings">
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
            deltaFlash={
              scoreDeltaFlash?.agentId === agent.id
                ? scoreDeltaFlash.delta
                : null
            }
            rowRef={setRef(agent.id)}
          />
        ))}
      </ol>
    </section>
  );
}
