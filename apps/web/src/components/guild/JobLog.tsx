import type { LogLine } from "@/lib/guild-sim/types";

const VARIANT_CLASS: Record<LogLine["variant"], string> = {
  default: "text-guild-muted",
  authority: "text-guild-accent",
  reputation: "text-guild-primary",
  revert: "rounded-inner bg-guild-danger-tint px-2 py-0.5 text-guild-danger",
};

type JobLogProps = {
  lines: LogLine[];
};

export function JobLog({ lines }: JobLogProps) {
  return (
    <section className="rounded-card border border-guild-border bg-guild-card p-5 shadow-soft">
      <h2 className="mb-3 text-base font-semibold text-guild-text">Job log</h2>
      <div
        className="max-h-52 overflow-y-auto rounded-inner border border-guild-border bg-guild-panel px-4 py-3"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        {lines.length === 0 ? (
          <p className="text-sm text-guild-faint">
            Run a job to stream settlement events.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {lines.map((line) => (
              <li
                key={line.id}
                className={`text-sm leading-snug ${VARIANT_CLASS[line.variant]}`}
              >
                <span className="mr-2 tabular-nums text-guild-faint">
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
