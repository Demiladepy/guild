const FOOTER_PILLS = [
  "A2A redelegation",
  "1Shot · gasless · USDC",
  "Venice · private AI",
  "ERC-8004 · reputation",
] as const;

export function Footer() {
  return (
    <footer className="flex flex-wrap gap-2 pt-2">
      {FOOTER_PILLS.map((pill) => (
        <span
          key={pill}
          className="rounded-pill border border-guild-border bg-guild-panel px-3 py-1 text-xs text-guild-muted"
        >
          {pill}
        </span>
      ))}
    </footer>
  );
}
