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
    <div className="guild-actions">
      <button
        type="button"
        onClick={onPrimary}
        disabled={isRunning}
        className="guild-btn guild-btn--accent"
        style={{ padding: "0.625rem 1.5rem" }}
      >
        {isRunning ? "Running…" : primaryLabel}
      </button>
      <button
        type="button"
        onClick={onOverspend}
        disabled={!canOverspend}
        className="guild-btn guild-btn--danger"
        style={{ padding: "0.625rem 1.25rem" }}
      >
        Attempt overspend
      </button>
    </div>
  );
}
