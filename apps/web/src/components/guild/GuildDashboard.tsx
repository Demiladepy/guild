"use client";

import { ActionBar } from "@/components/guild/ActionBar";
import { AuthorityLadder } from "@/components/guild/AuthorityLadder";
import { ConnectPanel } from "@/components/guild/ConnectPanel";
import { Footer } from "@/components/guild/Footer";
import { JobLog } from "@/components/guild/JobLog";
import { RegistryPanel } from "@/components/guild/RegistryPanel";
import { Standings } from "@/components/guild/Standings";
import { TopBar } from "@/components/guild/TopBar";
import { VeniceCard } from "@/components/guild/VeniceCard";
import { WorkflowStepper } from "@/components/guild/WorkflowStepper";
import { useGuildApp } from "@/hooks/useGuildApp";

export function GuildDashboard() {
  const app = useGuildApp();

  return (
    <div className="guild-app">
      <TopBar
        budgetGranted={Boolean(app.permission)}
        mode={app.mode}
        settlementMode={app.settlementMode}
      />

      {app.toast && (
        <div role="status" className="guild-toast">
          {app.toast}
        </div>
      )}

      <WorkflowStepper current={app.workflowStep} mode={app.mode} />

      <div className="guild-grid">
        <div className="guild-stack">
          <Standings
            agents={app.agents}
            hiredId={app.hiredId}
            eligibleCount={app.eligibleCount}
            scoreDeltaFlash={app.scoreDeltaFlash}
            displayScore={app.displayScore}
            selectedAgentId={app.selectedAgentId}
            onSelectAgent={app.setSelectedAgentId}
          />
          <RegistryPanel
            registry={app.registry}
            loading={app.registryLoading}
            registeredAgents={app.registeredAgents}
          />
        </div>

        <div className="guild-stack">
          <ConnectPanel
            step={app.workflowStep}
            mode={app.mode}
            walletAddress={app.walletAddress}
            contractorAddress={app.contractorAddress}
            permissionGranted={app.permissionGranted}
            busy={app.busy}
            onConnect={app.connectWallet}
            onGrant={app.grantBudget}
            onRegister={app.registerAgents}
            registryDeployed={app.registryDeployed}
          />
          <AuthorityLadder
            hiredName={app.hiredAgent?.name ?? null}
            shake={false}
          />
          <VeniceCard output={app.veniceOutput} active={app.veniceActive} />
          <JobLog lines={app.logLines} />
          {app.isRunning && (
            <div className="guild-progress-bar" aria-hidden>
              <div />
            </div>
          )}
          <ActionBar
            primaryLabel={app.primaryLabel}
            onPrimary={app.postJobAndHire}
            onOverspend={app.attemptOverspend}
            isRunning={app.isRunning || app.busy !== null}
            canOverspend={app.canOverspend}
          />
          <p className="guild-hint">
            <strong className="guild-text">Post job &amp; hire</strong> reads on-chain
            reputation, redelegates budget, pays Venice via x402, and writes ERC-8004
            feedback. Run again to re-hire by updated scores.
          </p>
        </div>
      </div>

      <Footer />
    </div>
  );
}
