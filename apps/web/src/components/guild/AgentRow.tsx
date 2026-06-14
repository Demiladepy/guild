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
  selected: boolean;
  onChain?: boolean;
  explorerUrl?: string;
  deltaFlash: number | null;
  rowRef: (el: HTMLLIElement | null) => void;
  onSelect: () => void;
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
  onSelect,
  onChain,
  explorerUrl,
  selected,
}: AgentRowProps) {
  const rankLabel = String(rank).padStart(2, "0");

  return (
    <li
      ref={rowRef}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect();
      }}
      className={`guild-agent ${
        hired
          ? "guild-agent--hired"
          : selected
            ? "guild-agent--selected"
            : ""
      } ${eligible ? "" : "guild-agent--ineligible"}`}
    >
      <span className="guild-agent__rank">{rankLabel}</span>

      <div className="guild-agent__body">
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem" }}>
          <p className="guild-agent__name">{name}</p>
          {hired && (
            <span
              className="guild-pill"
              style={{
                background: "var(--guild-accent)",
                color: "#fff",
                fontSize: "0.625rem",
                fontWeight: 700,
                textTransform: "uppercase",
                padding: "0.125rem 0.5rem",
              }}
            >
              hired
            </span>
          )}
        </div>
        <p className="guild-agent__meta">
          #{agentId} · {jobsCompleted} jobs
          {onChain && (
            <span style={{ marginLeft: "0.25rem", color: "var(--guild-success)", fontWeight: 500 }}>
              · on-chain
            </span>
          )}
        </p>
        {explorerUrl && selected && (
          <a
            href={explorerUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="guild-link"
            style={{ display: "inline-block", marginTop: "0.25rem", fontSize: "0.625rem" }}
          >
            View on explorer
          </a>
        )}
        <span
          className="guild-pill"
          style={{
            display: "inline-block",
            marginTop: "0.25rem",
            fontSize: "0.625rem",
            textTransform: "uppercase",
          }}
        >
          {CAPABILITY_LABEL[capability]}
        </span>
      </div>

      <div className="guild-agent__score">
        {deltaFlash !== null && (
          <span
            style={{
              position: "absolute",
              right: 0,
              top: "-1.25rem",
              fontSize: "0.75rem",
              fontWeight: 700,
              color: deltaFlash > 0 ? "var(--guild-primary)" : "var(--guild-danger)",
            }}
          >
            {deltaFlash > 0 ? `+${deltaFlash}` : deltaFlash}
          </span>
        )}
        <p className="guild-agent__score-value">{score}</p>
        <div className="guild-progress">
          <span style={{ width: `${Math.min(100, (score / 900) * 100)}%` }} />
        </div>
        <span
          style={{
            display: "inline-block",
            marginTop: "0.25rem",
            fontSize: "0.625rem",
            fontWeight: 500,
            textTransform: "uppercase",
            color: eligible ? "var(--guild-success)" : "var(--guild-faint)",
          }}
        >
          {eligible ? "eligible" : "ineligible"}
        </span>
      </div>
    </li>
  );
}
