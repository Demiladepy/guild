type VeniceCardProps = {
  output: string | null;
  active: boolean;
};

export function VeniceCard({ output, active }: VeniceCardProps) {
  return (
    <section className="guild-card">
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
        <span
          className={`guild-dot ${active ? "guild-dot--primary" : ""}`}
          style={{ width: "0.625rem", height: "0.625rem" }}
          aria-hidden
        />
        <h2 style={{ margin: 0 }}>Venice · private inference</h2>
      </div>
      <div className="guild-panel" style={{ minHeight: "5.5rem" }}>
        {output ? (
          <p className="guild-text" style={{ margin: 0, fontSize: "0.875rem", lineHeight: 1.6 }}>
            {output}
          </p>
        ) : (
          <p className="guild-faint" style={{ margin: 0, fontSize: "0.875rem" }}>
            Model output appears after x402 payment settles.
          </p>
        )}
      </div>
    </section>
  );
}
