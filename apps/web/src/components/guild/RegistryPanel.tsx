"use client";

import { addresses, chain, explorerNftUrl, explorerTxUrl } from "@guild/core/config";
import type { RegistryStatus } from "@/lib/verify-registry";
import type { RegisteredGuildAgent } from "@/lib/agent-registry";

type RegistryPanelProps = {
  registry: RegistryStatus | null;
  loading: boolean;
  registeredAgents: RegisteredGuildAgent[];
};

function truncate(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function RegistryPanel({
  registry,
  loading,
  registeredAgents,
}: RegistryPanelProps) {
  const deployed =
    registry?.identityDeployed && registry?.reputationDeployed;

  return (
    <section className="guild-card">
      <div
        style={{
          marginBottom: "0.75rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.5rem",
        }}
      >
        <h2>On-chain registries</h2>
        <span
          className={`guild-status ${
            deployed ? "guild-status--ok" : "guild-status--bad"
          }`}
        >
          {loading ? "checking…" : deployed ? "deployed" : "unavailable"}
        </span>
      </div>
      <p className="guild-muted" style={{ margin: "0 0 1rem", fontSize: "0.75rem", lineHeight: 1.5 }}>
        ERC-8004 singletons on {chain.name} — verified from{" "}
        <span style={{ fontFamily: "var(--guild-mono)", color: "var(--guild-text)" }}>
          erc-8004-contracts
        </span>
        . Your agents mint identities here; reputation writes land in the feedback
        registry.
      </p>

      {registry && (
        <ul className="guild-list">
          <li className="guild-registry__row">
            <span className="guild-muted">IdentityRegistry</span>
            <a
              href={`${explorerTxUrl.replace("/tx", "/address")}/${registry.identityRegistry}`}
              target="_blank"
              rel="noreferrer"
              className="guild-link"
            >
              {truncate(registry.identityRegistry)}
            </a>
          </li>
          <li className="guild-registry__row">
            <span className="guild-muted">ReputationRegistry</span>
            <a
              href={`${explorerTxUrl.replace("/tx", "/address")}/${registry.reputationRegistry}`}
              target="_blank"
              rel="noreferrer"
              className="guild-link"
            >
              {truncate(registry.reputationRegistry)}
            </a>
          </li>
        </ul>
      )}

      {registeredAgents.length > 0 && (
        <div style={{ marginTop: "1rem", borderTop: "1px solid var(--guild-border)", paddingTop: "1rem" }}>
          <p className="guild-text" style={{ margin: "0 0 0.5rem", fontSize: "0.75rem", fontWeight: 600 }}>
            Your registered agents
          </p>
          <ul className="guild-list">
            {registeredAgents.map((agent) => (
              <li
                key={agent.agentId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: "0.75rem",
                }}
              >
                <span className="guild-text" style={{ fontWeight: 500 }}>
                  {agent.name}
                </span>
                <a
                  href={`${explorerNftUrl}/${agent.agentId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="guild-link"
                >
                  #{agent.agentId}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!loading && !deployed && (
        <p style={{ marginTop: "0.75rem", fontSize: "0.75rem", color: "var(--guild-danger)" }}>
          Registry bytecode not found — check RPC / CHAIN_MODE ({addresses.identityRegistry}).
        </p>
      )}
    </section>
  );
}
