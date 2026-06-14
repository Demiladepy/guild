import type { Capability } from "@/lib/guild-sim/types";

const CAPABILITY_LABEL: Record<Capability, string> = {
  analysis: "ANALYSIS",
  research: "RESEARCH",
  synthesis: "SYNTHESIS",
};

type AgentRowProps = {
  rank: number;
  name: string;
  agentId: string;
  jobsCompleted: number;
  capability: Capability;
  score: number;
  eligible: boolean;
  hired: boolean;
  deltaFlash: number | null;
  rowRef: (el: HTMLLIElement | null) => void;
};

export function AgentRow({
  rank,
  name,
  agentId,
  jobsCompleted,
  capability,
  score,
  eligible,
  hired,
  deltaFlash,
  rowRef,
}: AgentRowProps) {
  const rankLabel = String(rank).padStart(2, "0");

  return (
    <li
      ref={rowRef}
      className={`relative flex items-center gap-3 rounded-inner border px-4 py-3 transition-colors duration-300 ${
        hired
          ? "border-guild-accent/40 bg-guild-accent-tint shadow-soft"
          : "border-guild-border bg-guild-card"
      } ${eligible ? "" : "opacity-45"}`}
      style={
        hired
          ? { borderLeftWidth: 3, borderLeftColor: "#F6851B" }
          : undefined
      }
    >
      <span
        className={`w-8 text-sm font-semibold tabular-nums ${
          hired ? "text-guild-accent" : "text-guild-faint"
        }`}
      >
        {rankLabel}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p
            className={`font-semibold ${
              hired ? "text-guild-accent" : "text-guild-text"
            }`}
          >
            {name}
          </p>
          {hired && (
            <span className="rounded-pill bg-guild-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              hired
            </span>
          )}
        </div>
        <p className="text-xs text-guild-muted">
          #{agentId} · {jobsCompleted} jobs
        </p>
        <span className="mt-1 inline-block rounded-pill border border-guild-border bg-guild-panel px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-guild-muted">
          {CAPABILITY_LABEL[capability]}
        </span>
      </div>

      <div className="relative w-28 shrink-0 text-right sm:w-32">
        {deltaFlash !== null && (
          <span
            className={`absolute -top-5 right-0 animate-score-pop text-xs font-bold tabular-nums ${
              deltaFlash > 0 ? "text-guild-primary" : "text-guild-danger"
            }`}
          >
            {deltaFlash > 0 ? `+${deltaFlash}` : deltaFlash}
          </span>
        )}
        <p className="text-lg font-semibold tabular-nums text-guild-primary">
          {score}
        </p>
        <div className="mt-1 h-1 overflow-hidden rounded-pill bg-guild-panel">
          <div
            className="h-full rounded-pill bg-guild-primary transition-all duration-500 ease-out"
            style={{ width: `${Math.min(100, (score / 900) * 100)}%` }}
          />
        </div>
        <span
          className={`mt-1 inline-block text-[10px] font-medium uppercase tracking-wide ${
            eligible ? "text-guild-success" : "text-guild-faint"
          }`}
        >
          {eligible ? "eligible" : "ineligible"}
        </span>
      </div>
    </li>
  );
}
