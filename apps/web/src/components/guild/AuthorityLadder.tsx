type AuthorityLadderProps = {
  hiredName: string | null;
  shake: boolean;
};

export function AuthorityLadder({ hiredName, shake }: AuthorityLadderProps) {
  const specialistLabel = hiredName ?? "— awaiting hire —";

  return (
    <section className="guild-card">
      <h2>Authority Ladder</h2>
      <p className="guild-muted" style={{ margin: "0.25rem 0 1rem", fontSize: "0.75rem" }}>
        authority can only shrink down the chain
      </p>

      <div className="guild-ladder__stack">
        <div className="guild-ladder__step">
          <p className="guild-muted" style={{ margin: 0, fontSize: "0.75rem" }}>
            Owner wallet
          </p>
          <p className="guild-text" style={{ margin: 0, fontSize: "0.875rem", fontWeight: 600 }}>
            10.00 USDC/wk
          </p>
        </div>

        <div className="guild-ladder__step guild-ladder__step--contractor">
          <p className="guild-muted" style={{ margin: 0, fontSize: "0.75rem" }}>
            Contractor
          </p>
          <p className="guild-text" style={{ margin: 0, fontSize: "0.875rem", fontWeight: 600 }}>
            10.00 USDC
          </p>
        </div>

        <div
          className={`guild-ladder__step guild-ladder__step--specialist ${
            shake ? "guild-ladder__step--shake" : ""
          }`}
        >
          <p style={{ margin: 0, fontSize: "0.75rem", fontWeight: 500, color: "var(--guild-accent)" }}>
            {specialistLabel}
          </p>
          <p className="guild-text" style={{ margin: 0, fontSize: "0.875rem", fontWeight: 600 }}>
            2.00 USDC · Venice-only
          </p>
        </div>
      </div>
    </section>
  );
}
