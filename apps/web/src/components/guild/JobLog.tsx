import type { LogLine } from "@/lib/guild-sim/types";

const VARIANT_CLASS: Record<LogLine["variant"], string> = {
  default: "guild-muted",
  authority: "log-authority",
  reputation: "log-reputation",
  revert: "log-revert",
};

type JobLogProps = {
  lines: LogLine[];
};

export function JobLog({ lines }: JobLogProps) {
  return (
    <section className="guild-card">
      <h2 style={{ marginBottom: "0.75rem" }}>Job log</h2>
      <div className="guild-panel guild-log" role="log" aria-live="polite" aria-relevant="additions">
        {lines.length === 0 ? (
          <p className="guild-faint" style={{ margin: 0, fontSize: "0.875rem" }}>
            Run a job to stream settlement events.
          </p>
        ) : (
          <ul>
            {lines.map((line) => (
              <li key={line.id} className={VARIANT_CLASS[line.variant]}>
                <span className="guild-faint" style={{ marginRight: "0.5rem" }}>
                  {line.timestamp}
                </span>
                {line.text}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
