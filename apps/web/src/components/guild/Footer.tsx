const FOOTER_PILLS = [
  "A2A redelegation",
  "1Shot · gasless · USDC",
  "Venice · private AI",
  "ERC-8004 · reputation",
] as const;

export function Footer() {
  return (
    <footer className="guild-footer">
      {FOOTER_PILLS.map((pill) => (
        <span key={pill} className="guild-pill">
          {pill}
        </span>
      ))}
    </footer>
  );
}
