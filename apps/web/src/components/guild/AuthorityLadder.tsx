type AuthorityLadderProps = {
  hiredName: string | null;
  shake: boolean;
};

export function AuthorityLadder({ hiredName, shake }: AuthorityLadderProps) {
  const specialistLabel = hiredName ?? "— awaiting hire —";

  return (
    <section className="rounded-card border border-guild-border bg-guild-card p-5 shadow-soft">
      <h2 className="text-base font-semibold text-guild-text">
        Authority Ladder
      </h2>
      <p className="mb-4 text-xs text-guild-muted">
        authority can only shrink down the chain
      </p>

      <div className="space-y-3">
        <div className="w-full rounded-inner border border-guild-border bg-guild-panel px-4 py-3">
          <p className="text-xs text-guild-muted">Owner wallet</p>
          <p className="text-sm font-semibold tabular-nums text-guild-text">
            10.00 USDC/wk
          </p>
        </div>

        <div className="w-[74%] rounded-inner border border-guild-border bg-guild-panel px-4 py-3">
          <p className="text-xs text-guild-muted">Contractor</p>
          <p className="text-sm font-semibold tabular-nums text-guild-text">
            10.00 USDC
          </p>
        </div>

        <div
          className={`w-1/2 min-w-[180px] rounded-inner border px-4 py-3 transition-colors ${
            shake
              ? "animate-shake border-guild-danger bg-guild-danger-tint"
              : "border-guild-accent/50 bg-guild-accent-tint"
          }`}
        >
          <p className="text-xs font-medium text-guild-accent">
            {specialistLabel}
          </p>
          <p className="text-sm font-semibold tabular-nums text-guild-text">
            2.00 USDC · Venice-only
          </p>
        </div>
      </div>
    </section>
  );
}
