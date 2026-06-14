type VeniceCardProps = {
  output: string | null;
  active: boolean;
};

export function VeniceCard({ output, active }: VeniceCardProps) {
  return (
    <section className="rounded-card border border-guild-border bg-guild-card p-5 shadow-soft">
      <div className="mb-3 flex items-center gap-2">
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            active ? "bg-guild-primary" : "bg-guild-faint"
          }`}
          aria-hidden
        />
        <h2 className="text-base font-semibold text-guild-text">
          Venice · private inference
        </h2>
      </div>
      <div className="min-h-[88px] rounded-inner border border-guild-border bg-guild-panel px-4 py-3">
        {output ? (
          <p className="text-sm leading-relaxed text-guild-text">{output}</p>
        ) : (
          <p className="text-sm text-guild-faint">
            Model output appears after x402 payment settles.
          </p>
        )}
      </div>
    </section>
  );
}
