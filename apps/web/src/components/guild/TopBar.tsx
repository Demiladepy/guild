export function TopBar() {
  return (
    <header className="flex flex-col gap-4 rounded-card border border-guild-border bg-guild-card px-5 py-4 shadow-soft sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-lg font-bold tracking-[0.18em] text-guild-text">
          GUILD
        </p>
        <p className="text-sm text-guild-muted">
          autonomous agent labor market
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {/* INTEGRATE: ERC-7715 requestExecutionPermissions → grant pill */}
        <span className="inline-flex items-center gap-2 rounded-pill border border-guild-border bg-guild-panel px-3 py-1.5 text-xs font-medium text-guild-text">
          <span
            className="h-2 w-2 rounded-full bg-guild-success"
            aria-hidden
          />
          Budget granted · 10 USDC / wk
        </span>
        <span className="rounded-pill border border-guild-border bg-guild-panel px-3 py-1.5 text-xs font-medium text-guild-muted">
          ERC-7715
        </span>
        <span className="rounded-pill border border-guild-border bg-guild-panel px-3 py-1.5 text-xs font-medium text-guild-muted">
          Base Sepolia
        </span>
      </div>
    </header>
  );
}
