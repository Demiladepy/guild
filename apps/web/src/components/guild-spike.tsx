"use client";

import { useCallback, useMemo, useState } from "react";
import {
  addresses,
  chain,
  chainMode,
  delegationCaps,
  explorerNftUrl,
  explorerTxUrl,
} from "@guild/core/config";
import type { GetGrantedExecutionPermissionsResult } from "@metamask/smart-accounts-kit/actions";
import {
  erc7710WalletActions,
  erc7715ProviderActions,
  type RedelegatePermissionContextReturnType,
} from "@metamask/smart-accounts-kit/actions";
import { decodeRevertReason } from "@metamask/smart-accounts-kit/utils";
import {
  createWalletClient,
  custom,
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  http,
  parseUnits,
} from "viem";
import {
  DelegationTree,
  type MarketLearned,
  type ReputationUpdate,
} from "@/components/delegation-tree";
import { writeSettlementFeedback } from "@/lib/agent-feedback";
import {
  hireTopSpecialist,
  listSpecialistCandidates,
  type SpecialistCandidate,
} from "@/lib/agent-hiring";
import { registerGuildAgents } from "@/lib/agent-registry";
import {
  getSpecialistAccount,
  VENICE_CAPABILITY,
} from "@/lib/agents";
import {
  SPECIALIST_TRANSFER_CAP,
  VENICE_X402_PATHS,
} from "@/lib/delegation-chain";
import { formatPermissionSummary } from "@/lib/permission-summary";
import type { RegisteredGuildAgent } from "@/lib/agent-registry";
import { getOrCreateContractorAccount } from "@/lib/session-account";
import {
  BLOCKED_ATTESTATION,
  buildSpecialistX402Client,
  runVeniceViaX402,
} from "@/lib/specialist-client";

type GrantedPermission = GetGrantedExecutionPermissionsResult[number];

const OVERSPEND_AMOUNT = parseUnits("3", 6);

export function GuildSpike() {
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [contractorAddress, setContractorAddress] = useState<
    `0x${string}` | null
  >(null);
  const [registeredAgents, setRegisteredAgents] = useState<
    RegisteredGuildAgent[]
  >([]);
  const [permission, setPermission] = useState<GrantedPermission | null>(null);
  const [permissionSummary, setPermissionSummary] = useState<string[]>([]);
  const [candidates, setCandidates] = useState<SpecialistCandidate[]>([]);
  const [hiredSpecialist, setHiredSpecialist] =
    useState<SpecialistCandidate | null>(null);
  const [redelegation, setRedelegation] =
    useState<RedelegatePermissionContextReturnType | null>(null);
  const [specialistOutput, setSpecialistOutput] = useState<string | null>(null);
  const [settlementTxHash, setSettlementTxHash] = useState<string | null>(null);
  const [feedbackTxHash, setFeedbackTxHash] = useState<string | null>(null);
  const [reputationUpdate, setReputationUpdate] =
    useState<ReputationUpdate | null>(null);
  const [marketLearned, setMarketLearned] = useState<MarketLearned | null>(null);
  const [previousRankOrder, setPreviousRankOrder] = useState<string[]>([]);
  const [lastHiredRole, setLastHiredRole] = useState<string | null>(null);
  const [overspendBlocked, setOverspendBlocked] = useState(false);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [runCount, setRunCount] = useState(0);

  const refreshCandidates = useCallback(
    async (contractor: `0x${string}`) => {
      const list = await listSpecialistCandidates({
        contractorAddress: contractor,
        requiredCapability: VENICE_CAPABILITY,
      });
      setCandidates(list);
      return list;
    },
    [],
  );

  const treeNodes = useMemo(
    () => [
      {
        id: "user",
        label: "User (MetaMask smart account)",
        cap: `${delegationCaps.userWeekly} USDC / week`,
        scope: "Root ERC-7715 grant",
        status: permission ? ("active" as const) : undefined,
      },
      {
        id: "contractor",
        label: "Contractor (hiring orchestrator)",
        cap: `${delegationCaps.contractorWeekly} USDC / week`,
        scope: contractorAddress ?? "Session account pending",
        status: permission ? ("active" as const) : undefined,
      },
      {
        id: "specialist",
        label: hiredSpecialist
          ? `${hiredSpecialist.name} · hired by reputation`
          : "Specialist market",
        cap: `${formatUnits(SPECIALIST_TRANSFER_CAP, 6)} USDC total`,
        scope: hiredSpecialist
          ? `Score ${hiredSpecialist.score.toFixed(2)} · Venice x402 · ${VENICE_X402_PATHS.join(", ")}`
          : `Capability: ${VENICE_CAPABILITY}`,
        status: overspendBlocked
          ? ("blocked" as const)
          : hiredSpecialist && specialistOutput
            ? ("hired" as const)
            : hiredSpecialist
              ? ("active" as const)
              : undefined,
      },
    ],
    [
      permission,
      contractorAddress,
      hiredSpecialist,
      overspendBlocked,
      specialistOutput,
    ],
  );

  async function handleConnect() {
    setBusy("connect");
    setError(null);
    setStatus("Connecting MetaMask on Base Sepolia…");

    try {
      if (!window.ethereum) {
        throw new Error(
          "MetaMask Flask 13.5.0+ is required. Install Flask and enable Advanced Permissions.",
        );
      }

      const walletClient = createWalletClient({
        chain,
        transport: custom(window.ethereum),
      }).extend(erc7715ProviderActions());

      const [address] = await walletClient.requestAddresses();

      try {
        await walletClient.switchChain({ id: chain.id });
      } catch {
        await walletClient.addChain({ chain });
      }

      const contractor = getOrCreateContractorAccount();

      setConnectedAddress(address);
      setContractorAddress(contractor.address);
      setStatus(
        `Connected ${address}. Contractor session ${contractor.address}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connect failed");
      setStatus(null);
    } finally {
      setBusy(null);
    }
  }

  async function handleGrant() {
    setBusy("grant");
    setError(null);
    setStatus("Requesting ERC-7715 periodic USDC budget in MetaMask…");

    try {
      if (!window.ethereum) {
        throw new Error("MetaMask not available");
      }

      const walletClient = createWalletClient({
        chain,
        transport: custom(window.ethereum),
      }).extend(erc7715ProviderActions());

      const contractor = getOrCreateContractorAccount();
      const currentTime = Math.floor(Date.now() / 1000);
      const expiry = currentTime + 60 * 60 * 24 * 30;

      const grantedPermissions = await walletClient.requestExecutionPermissions([
        {
          chainId: chain.id,
          expiry,
          to: contractor.address,
          permission: {
            type: "erc20-token-periodic",
            data: {
              tokenAddress: addresses.usdc,
              periodAmount: parseUnits("10", 6),
              periodDuration: 604800,
              startTime: currentTime,
              justification: "Guild Contractor weekly working budget",
            },
            isAdjustmentAllowed: true,
          },
        },
      ]);

      const granted = grantedPermissions[0];
      if (!granted) {
        throw new Error("No permission returned from MetaMask");
      }

      setPermission(granted);
      setPermissionSummary(formatPermissionSummary(granted));
      setStatus(
        "Permission granted. Review the summary — this is the qualification moment.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Grant failed");
      setStatus(null);
    } finally {
      setBusy(null);
    }
  }

  async function handleRegisterAgents() {
    setBusy("register");
    setError(null);
    setStatus(
      "Registering Researcher, Analyst, Writer as ERC-8004 identities…",
    );

    try {
      const { specialists, seedTxHashes } = await registerGuildAgents();
      setRegisteredAgents(specialists);
      if (contractorAddress) {
        await refreshCandidates(contractorAddress);
      }
      setStatus(
        `Registered ${specialists.length} specialists. Seeded uneven reputation (${seedTxHashes.length} tx).`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleHire() {
    setBusy("hire");
    setError(null);
    setStatus("Contractor reading Reputation Registry and hiring top specialist…");

    try {
      if (!permission || !contractorAddress) {
        throw new Error("Connect and grant before hiring");
      }

      const contractor = getOrCreateContractorAccount();
      const result = await hireTopSpecialist({
        contractorAccount: contractor,
        contractorAddress,
        parentPermission: permission,
      });

      setHiredSpecialist(result.hired);
      setRedelegation(result.redelegation);
      setCandidates(result.candidates);
      setLastHiredRole(result.hired.role);
      setStatus(
        `Hired ${result.hired.name} (score ${result.hired.score.toFixed(2)}) — attenuated redelegation signed.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiring failed");
    } finally {
      setBusy(null);
    }
  }

  async function executeSpecialistJob() {
    if (!permission || !redelegation || !hiredSpecialist || !contractorAddress) {
      throw new Error("Hire a specialist before running inference");
    }

    setSpecialistOutput(null);
    setSettlementTxHash(null);
    setFeedbackTxHash(null);
    setReputationUpdate(null);
    setMarketLearned(null);
    setStatus(
      `${hiredSpecialist.name}: Venice /chat/completions via x402 delegated payment…`,
    );

    const contractor = getOrCreateContractorAccount();
    const specialist = getSpecialistAccount(hiredSpecialist.role);

    const venice = await runVeniceViaX402({
      specialistAccount: specialist,
      redelegatedContext: redelegation.permissionContext,
      contractorAddress: contractor.address,
    });

    if (!venice.settlementTx) {
      throw new Error("x402 settlement tx missing from Venice response");
    }

    setSpecialistOutput(venice.content);
    setSettlementTxHash(venice.settlementTx);

    const nextRun = runCount + 1;
    const feedback = await writeSettlementFeedback({
      contractor,
      hired: hiredSpecialist,
      settlementTxHash: venice.settlementTx,
      runNumber: nextRun,
    });

    setFeedbackTxHash(feedback.feedbackTxHash);
    setReputationUpdate({
      role: hiredSpecialist.role,
      name: hiredSpecialist.name,
      scoreBefore: feedback.scoreBefore,
      scoreAfter: feedback.scoreAfter,
      feedbackScore: feedback.feedbackScore,
      animate: true,
    });

    setPreviousRankOrder(candidates.map((c) => c.role));
    const updated = await refreshCandidates(contractorAddress);
    const refreshed = updated.find((c) => c.role === hiredSpecialist.role);
    if (refreshed) setHiredSpecialist(refreshed);

    setRunCount(nextRun);
    setStatus(
      `${hiredSpecialist.name} complete — x402 settled, reputation signal ${feedback.feedbackScore} on-chain.`,
    );
  }

  async function handleRunJob() {
    setBusy("specialist");
    setError(null);
    try {
      await executeSpecialistJob();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Specialist run failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleRunAgain() {
    setBusy("again");
    setError(null);
    setReputationUpdate(null);
    setMarketLearned(null);
    setStatus("Re-hiring by updated reputation, then running job again…");

    try {
      if (!permission || !contractorAddress || runCount === 0) {
        throw new Error("Complete a first run before Run again");
      }

      const priorHired = hiredSpecialist;
      setPreviousRankOrder(candidates.map((c) => c.role));

      const contractor = getOrCreateContractorAccount();
      const result = await hireTopSpecialist({
        contractorAccount: contractor,
        contractorAddress,
        parentPermission: permission,
      });

      if (
        priorHired &&
        result.hired.role !== priorHired.role &&
        lastHiredRole
      ) {
        setMarketLearned({
          fromRole: priorHired.role,
          fromName: priorHired.name,
          toRole: result.hired.role,
          toName: result.hired.name,
        });
      }

      setHiredSpecialist(result.hired);
      setRedelegation(result.redelegation);
      setCandidates(result.candidates);
      setLastHiredRole(result.hired.role);
      setStatus(
        `Re-hired ${result.hired.name} (score ${result.hired.score.toFixed(2)}) — ${
          priorHired && result.hired.role !== priorHired.role
            ? "different specialist chosen after reputation shift"
            : "top score unchanged"
        }.`,
      );

      await executeSpecialistJob();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Run again failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleOverspend() {
    setBusy("overspend");
    setError(null);
    setBlockedMessage(null);
    setOverspendBlocked(false);
    setStatus("Hired specialist attempting 3 USDC payment (2 USDC cap)…");

    try {
      if (!redelegation || !hiredSpecialist) {
        throw new Error("Hire a specialist before testing attenuation");
      }

      const contractor = getOrCreateContractorAccount();
      const specialist = getSpecialistAccount(hiredSpecialist.role);
      const { delegationProvider } = buildSpecialistX402Client({
        specialistAccount: specialist,
        redelegatedContext: redelegation.permissionContext,
        contractorAddress: contractor.address,
      });

      const paymentRequirements = {
        scheme: "exact",
        network: "eip155:84532",
        asset: addresses.usdc,
        amount: OVERSPEND_AMOUNT.toString(),
        payTo: specialist.address,
        maxTimeoutSeconds: 300,
      };

      const paymentPayload = await delegationProvider(paymentRequirements);

      const specialistWalletClient = createWalletClient({
        account: specialist,
        chain,
        transport: http(),
      }).extend(erc7710WalletActions());

      const transferCalldata = encodeFunctionData({
        abi: erc20Abi,
        functionName: "transfer",
        args: [specialist.address, OVERSPEND_AMOUNT],
      });

      await specialistWalletClient.sendTransactionWithDelegation({
        account: specialist,
        chain,
        permissionContext: paymentPayload.permissionContext,
        delegationManager: paymentPayload.delegationManager,
        to: addresses.usdc,
        data: transferCalldata,
      });

      setError("Expected over-cap redemption to revert, but it succeeded.");
    } catch (err) {
      const decoded = decodeRevertReason(err);
      setOverspendBlocked(true);
      setBlockedMessage(BLOCKED_ATTESTATION);

      let wrongTargetNote = "";
      try {
        const contractor = getOrCreateContractorAccount();
        const specialist = getSpecialistAccount(hiredSpecialist!.role);
        const { delegationProvider } = buildSpecialistX402Client({
          specialistAccount: specialist,
          redelegatedContext: redelegation!.permissionContext,
          contractorAddress: contractor.address,
        });
        const smallPayment = await delegationProvider({
          scheme: "exact",
          network: "eip155:84532",
          asset: addresses.usdc,
          amount: parseUnits("0.01", 6).toString(),
          payTo: specialist.address,
          maxTimeoutSeconds: 300,
        });
        const specialistWalletClient = createWalletClient({
          account: specialist,
          chain,
          transport: http(),
        }).extend(erc7710WalletActions());
        await specialistWalletClient.sendTransactionWithDelegation({
          account: specialist,
          chain,
          permissionContext: smallPayment.permissionContext,
          delegationManager: smallPayment.delegationManager,
          to: "0x0000000000000000000000000000000000000001",
          data: "0x",
        });
      } catch (wrongTargetErr) {
        const wrongDecoded = decodeRevertReason(wrongTargetErr);
        wrongTargetNote = wrongDecoded
          ? ` Non-Venice target also blocked (${wrongDecoded.errorName}).`
          : " Non-Venice target also blocked by allowedTargets.";
      }

      setStatus(
        (decoded
          ? `Revert caught: ${decoded.errorName} — ${decoded.message}`
          : BLOCKED_ATTESTATION) + wrongTargetNote,
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-8">
      <header className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">Guild</h1>
        <p className="text-slate-400">
          Reputation-weighted agent hiring on {chain.name} ({chainMode}) — ERC-8004
          identities learn across runs. ERC-7715 consent gate → hire → x402 Venice →
          feedback write-back.
        </p>
      </header>

      <DelegationTree
        nodes={treeNodes}
        candidates={candidates}
        hiredRole={hiredSpecialist?.role ?? null}
        previousRankOrder={previousRankOrder}
        overspendBlocked={overspendBlocked}
        reputationUpdate={reputationUpdate}
        marketLearned={marketLearned}
        explorerNftUrl={explorerNftUrl}
      />

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleConnect}
          disabled={busy !== null}
          className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {busy === "connect" ? "Connecting…" : "1 Connect"}
        </button>
        <button
          type="button"
          onClick={handleGrant}
          disabled={!connectedAddress || busy !== null}
          className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {busy === "grant" ? "Granting…" : "2 Grant Budget"}
        </button>
        <button
          type="button"
          onClick={handleRegisterAgents}
          disabled={!connectedAddress || busy !== null}
          className="rounded-lg bg-cyan-600 px-4 py-2 font-medium text-white hover:bg-cyan-500 disabled:opacity-50"
        >
          {busy === "register" ? "Registering…" : "3 Register ERC-8004"}
        </button>
        <button
          type="button"
          onClick={handleHire}
          disabled={!permission || registeredAgents.length === 0 || busy !== null}
          className="rounded-lg bg-violet-600 px-4 py-2 font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {busy === "hire" ? "Hiring…" : "4 Hire by Reputation"}
        </button>
        <button
          type="button"
          onClick={handleRunJob}
          disabled={!redelegation || busy !== null}
          className="rounded-lg bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-500 disabled:opacity-50"
        >
          {busy === "specialist" ? "Running…" : "5 Run Job"}
        </button>
        <button
          type="button"
          onClick={handleRunAgain}
          disabled={runCount === 0 || busy !== null}
          className="rounded-lg bg-orange-600 px-4 py-2 font-medium text-white hover:bg-orange-500 disabled:opacity-50"
        >
          {busy === "again" ? "Learning…" : "6 Run Again"}
        </button>
        <button
          type="button"
          onClick={handleOverspend}
          disabled={!redelegation || busy !== null}
          className="rounded-lg bg-red-700 px-4 py-2 font-medium text-white hover:bg-red-600 disabled:opacity-50"
        >
          {busy === "overspend" ? "Testing…" : "7 Try Overspend"}
        </button>
      </div>

      {connectedAddress && (
        <section className="rounded-lg border border-slate-800 bg-slate-900/50 p-4 text-sm">
          <h2 className="mb-2 font-semibold text-slate-200">Accounts</h2>
          <p className="font-mono text-slate-400">User EOA: {connectedAddress}</p>
          {contractorAddress && (
            <p className="font-mono text-slate-400">
              Contractor: {contractorAddress}
            </p>
          )}
        </section>
      )}

      {registeredAgents.length > 0 && (
        <section className="rounded-lg border border-cyan-900/50 bg-cyan-950/20 p-4 text-sm">
          <h2 className="mb-2 font-semibold text-cyan-200">ERC-8004 identities</h2>
          <ul className="space-y-1">
            {registeredAgents.map((agent) => (
              <li key={agent.role} className="text-cyan-100/90">
                {agent.name} · agent #{agent.agentId}{" "}
                <a
                  href={`${explorerNftUrl}/${agent.agentId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-cyan-300 underline"
                >
                  explorer
                </a>
                {agent.registrationTxHash && (
                  <span className="ml-2 font-mono text-xs text-cyan-400/70">
                    tx {agent.registrationTxHash.slice(0, 10)}…
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {permissionSummary.length > 0 && (
        <section className="rounded-lg border border-emerald-900/50 bg-emerald-950/20 p-4">
          <h2 className="mb-2 font-semibold text-emerald-200">
            Granted permission summary
          </h2>
          <ul className="space-y-1 text-sm text-emerald-100/90">
            {permissionSummary.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      )}

      {redelegation && hiredSpecialist && (
        <section className="rounded-lg border border-violet-900/50 bg-violet-950/20 p-4 text-sm">
          <h2 className="mb-2 font-semibold text-violet-200">
            Hired · {hiredSpecialist.name}
          </h2>
          <p className="text-violet-100/90">
            Contractor → {hiredSpecialist.name} (score{" "}
            {hiredSpecialist.score.toFixed(2)}). Delegate:{" "}
            {redelegation.delegation.delegate}
          </p>
          <p className="mt-1 text-xs text-violet-300/80">
            Attenuated: 2 USDC cap, USDC transfer only, Venice endpoints.
          </p>
        </section>
      )}

      {specialistOutput && (
        <section className="rounded-lg border border-indigo-900/50 bg-indigo-950/20 p-4">
          <h2 className="mb-2 font-semibold text-indigo-200">
            {hiredSpecialist?.name ?? "Specialist"} Venice output
          </h2>
          <p className="whitespace-pre-wrap text-sm text-indigo-100/90">
            {specialistOutput}
          </p>
        </section>
      )}

      {settlementTxHash && (
        <section className="rounded-lg border border-amber-900/50 bg-amber-950/20 p-4 text-sm">
          <h2 className="mb-2 font-semibold text-amber-200">x402 settlement</h2>
          <a
            href={`${explorerTxUrl}/${settlementTxHash}`}
            target="_blank"
            rel="noreferrer"
            className="break-all font-mono text-amber-300 underline hover:text-amber-200"
          >
            {settlementTxHash}
          </a>
        </section>
      )}

      {feedbackTxHash && (
        <section className="rounded-lg border border-emerald-900/50 bg-emerald-950/20 p-4 text-sm">
          <h2 className="mb-2 font-semibold text-emerald-200">
            Reputation feedback tx
          </h2>
          <a
            href={`${explorerTxUrl}/${feedbackTxHash}`}
            target="_blank"
            rel="noreferrer"
            className="break-all font-mono text-emerald-300 underline"
          >
            {feedbackTxHash}
          </a>
        </section>
      )}

      {blockedMessage && (
        <section className="rounded-lg border border-red-900/60 bg-red-950/30 p-4">
          <h2 className="mb-2 font-semibold text-red-300">Attenuation proof</h2>
          <p className="text-sm text-red-200">{blockedMessage}</p>
        </section>
      )}

      {status && (
        <p className="text-sm text-slate-400" role="status">
          {status}
        </p>
      )}
      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      <p className="text-xs text-slate-600">
        ERC-8004: {addresses.identityRegistry}. Fund Contractor + 3 specialist EOAs
        with ETH (registry/reputation) and USDC (x402). Set{" "}
        {`NEXT_PUBLIC_APP_URL`} and {`X402_PAYTO_ADDRESS`}.
      </p>
    </main>
  );
}
