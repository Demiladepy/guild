import type { WorkflowStep } from "@/hooks/useGuildApp";

type ConnectPanelProps = {
  step: WorkflowStep;
  mode: "demo" | "live";
  walletAddress: string | null;
  contractorAddress: `0x${string}` | null;
  permissionGranted: boolean;
  busy: string | null;
  onConnect: () => void;
  onGrant: () => void;
  onRegister: () => void;
  registryDeployed: boolean;
};

export function ConnectPanel({
  step,
  mode,
  walletAddress,
  contractorAddress,
  permissionGranted,
  busy,
  onConnect,
  onGrant,
  onRegister,
  registryDeployed,
}: ConnectPanelProps) {
  return (
    <section className="guild-card">
      <h2>Agent integration</h2>
      <p className="guild-muted" style={{ marginTop: "0.25rem", fontSize: "0.875rem" }}>
        Connect MetaMask, grant ERC-7715 budget, and register ERC-8004 agents to
        run the live reputation loop.
      </p>

      <div className="guild-btn-row">
        <button
          type="button"
          onClick={onConnect}
          disabled={busy !== null || Boolean(walletAddress)}
          className="guild-btn guild-btn--primary"
        >
          {walletAddress ? "Wallet connected" : "Connect MetaMask"}
        </button>
        <button
          type="button"
          onClick={onGrant}
          disabled={busy !== null || !walletAddress || permissionGranted}
          className="guild-btn guild-btn--secondary"
        >
          {permissionGranted ? "Budget granted" : "Grant budget"}
        </button>
        <button
          type="button"
          onClick={onRegister}
          disabled={
            busy !== null ||
            !registryDeployed ||
            !permissionGranted
          }
          title={
            !registryDeployed
              ? "Waiting for registry verification"
              : step !== "register" && step !== "operate"
                ? "Grant budget first"
                : undefined
          }
          className="guild-btn guild-btn--secondary"
        >
          Register agents
        </button>
      </div>

      {(walletAddress || contractorAddress) && (
        <dl className="guild-meta">
          {walletAddress && (
            <div>
              <dt>Owner wallet</dt>
              <dd>{walletAddress}</dd>
            </div>
          )}
          {contractorAddress && (
            <div>
              <dt>Contractor</dt>
              <dd>{contractorAddress}</dd>
            </div>
          )}
          {step === "operate" && (
            <p style={{ margin: "0.5rem 0 0", color: "var(--guild-success)" }}>
              Ready to hire on-chain specialists.
            </p>
          )}
        </dl>
      )}
    </section>
  );
}
