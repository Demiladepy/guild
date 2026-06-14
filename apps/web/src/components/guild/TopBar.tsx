import { GuildLogo } from "@/components/guild/GuildLogo";

type TopBarProps = {
  budgetGranted: boolean;
  mode: "demo" | "live";
  settlementMode?: "x402" | "relayer";
};

export function TopBar({ budgetGranted, mode, settlementMode = "x402" }: TopBarProps) {
  return (
    <header className="guild-card guild-header">
      <div className="guild-header__brand">
        <GuildLogo size={44} />
        <div>
          <p className="guild-header__title">GUILD</p>
          <p className="guild-header__subtitle">
            autonomous agent labor market
          </p>
        </div>
      </div>
      <div className="guild-badges">
        <span
          className={`guild-pill ${
            budgetGranted ? "guild-pill--success" : ""
          }`}
        >
          <span
            className={`guild-dot ${
              budgetGranted ? "guild-dot--success" : ""
            }`}
            aria-hidden
          />
          {budgetGranted ? "Budget granted · 10 USDC / wk" : "Budget pending"}
        </span>
        <span className="guild-pill">ERC-7715</span>
        <span className="guild-pill">
          {settlementMode === "relayer" ? "1Shot relayer" : "x402"}
        </span>
        <span className="guild-pill">
          {settlementMode === "relayer" ? "Base mainnet" : "Base Sepolia"}
        </span>
        <span
          className={`guild-pill ${
            mode === "live" ? "guild-pill--accent" : "guild-pill--primary"
          }`}
        >
          {mode === "live" ? "live" : "demo"}
        </span>
      </div>
    </header>
  );
}
