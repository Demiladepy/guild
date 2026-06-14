type ActionBarProps = {
  primaryLabel: string;
  onPrimary: () => void;
  onOverspend: () => void;
  isRunning: boolean;
  canOverspend: boolean;
};

export function ActionBar({
  primaryLabel,
  onPrimary,
  onOverspend,
  isRunning,
  canOverspend,
}: ActionBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={onPrimary}
        disabled={isRunning}
        className="rounded-pill bg-guild-accent px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#e2761a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-guild-accent disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isRunning ? "Running…" : primaryLabel}
      </button>
      <button
        type="button"
        onClick={onOverspend}
        disabled={!canOverspend}
        className="rounded-pill border border-guild-border bg-transparent px-5 py-2.5 text-sm font-medium text-guild-muted transition-colors hover:border-guild-danger hover:text-guild-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-guild-danger disabled:cursor-not-allowed disabled:opacity-40"
      >
        Attempt overspend
      </button>
    </div>
  );
}
