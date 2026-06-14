"use client";

import {
  addresses,
  chain,
  explorerNftUrl,
  explorerTxUrl,
} from "@guild/core/config";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createWalletClient,
  custom,
  encodeFunctionData,
  erc20Abi,
  parseUnits,
} from "viem";
import {
  erc7710WalletActions,
  erc7715ProviderActions,
} from "@metamask/smart-accounts-kit/actions";
import type {
  GetGrantedExecutionPermissionsResult,
  RedelegatePermissionContextReturnType,
} from "@metamask/smart-accounts-kit/actions";
import { registerGuildAgents, type RegisteredGuildAgent } from "@/lib/agent-registry";
import { writeSettlementFeedback } from "@/lib/agent-feedback";
import {
  hireTopSpecialist,
  listSpecialistCandidates,
  type SpecialistCandidate,
} from "@/lib/agent-hiring";
import {
  GUILD_AGENT_DEFINITIONS,
  getSpecialistAccount,
  VENICE_CAPABILITY,
  type SpecialistRole,
} from "@/lib/agents";
import { getOrCreateContractorAccount } from "@/lib/session-account";
import { getGuildHttpTransport } from "@/lib/chain-transport";
import { formatJobError } from "@/lib/job-errors";
import {
  buildSpecialistX402Client,
  runVeniceViaX402,
} from "@/lib/specialist-client";
import { verifyRegistriesDeployed, type RegistryStatus } from "@/lib/verify-registry";
import type {
  Agent,
  Capability,
  LogLine,
  LogVariant,
  ScoreDeltaFlash,
} from "@/lib/guild-sim/types";
import { JOB_CAPABILITY } from "@/lib/guild-sim/types";

export type WorkflowStep =
  | "connect"
  | "grant"
  | "register"
  | "operate";

type GrantedPermission = GetGrantedExecutionPermissionsResult[number];

const ROLE_CAPABILITY: Record<SpecialistRole, Capability> = {
  researcher: "analysis",
  analyst: "analysis",
  writer: "synthesis",
};

const OVERSPEND_AMOUNT = parseUnits("3", 6);

function nowStamp() {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sortByScore(agents: Agent[]) {
  return [...agents].sort((a, b) => b.score - a.score);
}

function mapLiveAgents(
  registered: RegisteredGuildAgent[],
  scores: Awaited<ReturnType<typeof listSpecialistCandidates>>,
): Agent[] {
  const mapped = registered.map((r) => {
    const role = r.role as SpecialistRole;
    const def = GUILD_AGENT_DEFINITIONS[role];
    const candidate = scores.find((s) => s.role === role);
    return {
      id: r.agentId,
      name: def.name,
      capability: ROLE_CAPABILITY[role],
      score: candidate?.score ?? def.seedScore,
      jobsCompleted: Number(candidate?.feedbackCount ?? 0),
      onChain: true,
      explorerUrl: `${explorerNftUrl}/${r.agentId}`,
      address: r.address,
    };
  });
  return sortByScore(mapped);
}

export function useGuildApp() {
  const [registry, setRegistry] = useState<RegistryStatus | null>(null);
  const [registryLoading, setRegistryLoading] = useState(true);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [contractorAddress, setContractorAddress] = useState<`0x${string}` | null>(null);
  const [permission, setPermission] = useState<GrantedPermission | null>(null);
  const [registeredAgents, setRegisteredAgents] = useState<RegisteredGuildAgent[]>([]);
  const [liveAgents, setLiveAgents] = useState<Agent[]>([]);
  const [hiredId, setHiredId] = useState<string | null>(null);
  const [hiredSpecialist, setHiredSpecialist] = useState<SpecialistCandidate | null>(null);
  const [redelegation, setRedelegation] =
    useState<RedelegatePermissionContextReturnType | null>(null);
  const [runCount, setRunCount] = useState(0);
  const [logLines, setLogLines] = useState<LogLine[]>([]);
  const [veniceOutput, setVeniceOutput] = useState<string | null>(null);
  const [veniceActive, setVeniceActive] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [scoreDeltaFlash, setScoreDeltaFlash] = useState<ScoreDeltaFlash>(null);
  const [animatingScores, setAnimatingScores] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 4000);
  }, []);

  const pushLog = useCallback(
    (
      text: string,
      variant: LogVariant = "default",
      href?: string,
    ) => {
      setLogLines((lines) => [
        ...lines,
        {
          id: `${Date.now()}-${lines.length}`,
          text,
          variant,
          timestamp: nowStamp(),
          href,
        },
      ]);
    },
    [],
  );

  const animateScore = useCallback(
    async (agentId: string, from: number, to: number) => {
      const reduced =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (reduced) {
        setAnimatingScores((s) => ({ ...s, [agentId]: to }));
        return;
      }

      const steps = 18;
      for (let i = 1; i <= steps; i++) {
        const value = Math.round(from + ((to - from) * i) / steps);
        setAnimatingScores((s) => ({ ...s, [agentId]: value }));
        await sleep(28);
      }
      setAnimatingScores((s) => {
        const next = { ...s };
        delete next[agentId];
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    verifyRegistriesDeployed()
      .then(setRegistry)
      .finally(() => setRegistryLoading(false));
  }, []);

  const workflowStep = useMemo((): WorkflowStep => {
    if (!walletAddress) return "connect";
    if (!permission) return "grant";
    if (registeredAgents.length === 0) return "register";
    return "operate";
  }, [walletAddress, permission, registeredAgents.length]);

  const agents = liveAgents;
  const hiredAgent = useMemo(
    () => agents.find((a) => a.id === hiredId) ?? null,
    [agents, hiredId],
  );

  const eligibleCount = useMemo(
    () => agents.filter((a) => a.capability === JOB_CAPABILITY).length,
    [agents],
  );

  const displayScore = useCallback(
    (agent: Agent) => animatingScores[agent.id] ?? agent.score,
    [animatingScores],
  );

  const connectWallet = useCallback(async () => {
    setBusy("connect");
    try {
      if (!window.ethereum) {
        throw new Error("Install MetaMask Flask 13.5+ with Advanced Permissions");
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
      setWalletAddress(address);
      setContractorAddress(contractor.address);
      showToast(`Connected ${address.slice(0, 6)}…${address.slice(-4)}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Connect failed");
    } finally {
      setBusy(null);
    }
  }, [showToast]);

  const grantBudget = useCallback(async () => {
    if (!window.ethereum || !contractorAddress) return;
    setBusy("grant");
    try {
      const walletClient = createWalletClient({
        chain,
        transport: custom(window.ethereum),
      }).extend(erc7715ProviderActions());

      const currentTime = Math.floor(Date.now() / 1000);
      const granted = await walletClient.requestExecutionPermissions([
        {
          chainId: chain.id,
          expiry: currentTime + 60 * 60 * 24 * 30,
          to: contractorAddress,
          permission: {
            type: "erc20-token-periodic",
            data: {
              tokenAddress: addresses.usdc,
              periodAmount: parseUnits("10", 6),
              periodDuration: 604800,
              startTime: currentTime,
              justification: "Guild Contractor weekly budget",
            },
            isAdjustmentAllowed: true,
          },
        },
      ]);

      const grant = granted[0];
      if (!grant) throw new Error("No permission returned");
      setPermission(grant);
      showToast("ERC-7715 budget granted to Contractor");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Grant failed");
    } finally {
      setBusy(null);
    }
  }, [contractorAddress, showToast]);

  const registerAgents = useCallback(async () => {
    setBusy("register");
    try {
      const { specialists } = await registerGuildAgents();
      setRegisteredAgents(specialists);
      if (contractorAddress) {
        const candidates = await listSpecialistCandidates({
          contractorAddress,
          requiredCapability: VENICE_CAPABILITY,
        });
        setLiveAgents(mapLiveAgents(specialists, candidates));
      }
      showToast(`Registered ${specialists.length} ERC-8004 agents on-chain`);
    } catch (err) {
      showToast(formatJobError(err, "register"));
    } finally {
      setBusy(null);
    }
  }, [contractorAddress, showToast]);

  const postJobAndHire = useCallback(async () => {
    if (isRunning || busy !== null) return;

    if (!permission || !contractorAddress || registeredAgents.length === 0) {
      showToast("Connect, grant budget, and register agents first");
      return;
    }

    setIsRunning(true);
    setVeniceOutput(null);
    setScoreDeltaFlash(null);

    let step = "reputation-read";

    try {
      const contractor = getOrCreateContractorAccount();

      pushLog("Reading ERC-8004 reputation registry…", "reputation");
      const candidates = await listSpecialistCandidates({
        contractorAddress,
        requiredCapability: VENICE_CAPABILITY,
      });

      if (candidates.length === 0) {
        throw new Error(
          "No registered specialists with on-chain reputation — register agents and wait for seed txs",
        );
      }

      pushLog(
        `On-chain scores: ${candidates.map((c) => `${c.name} ${c.score.toFixed(2)}`).join(" · ")}`,
        "reputation",
      );

      const priorRole = hiredSpecialist?.role ?? null;
      const eligibleNames = candidates.map((c) => c.name).join(", ");
      pushLog(
        `Eligible · ${VENICE_CAPABILITY}: ${eligibleNames}`,
        "default",
      );

      step = "hire";
      const hireResult = await hireTopSpecialist({
        contractorAccount: contractor,
        contractorAddress,
        parentPermission: permission,
        requiredCapability: VENICE_CAPABILITY,
      });

      if (priorRole && hireResult.hired.role !== priorRole) {
        const priorName = GUILD_AGENT_DEFINITIONS[priorRole].name;
        pushLog(
          `On-chain re-hire: ${priorName} → ${hireResult.hired.name} (rank changed)`,
          "reputation",
        );
      }

      setHiredSpecialist(hireResult.hired);
      setHiredId(hireResult.hired.agentId);
      setRedelegation(hireResult.redelegation);

      pushLog(
        `Hired ${hireResult.hired.name} (score ${hireResult.hired.score.toFixed(2)}) — top of capability`,
        "authority",
      );
      pushLog(
        "Contractor redelegates · attenuated to 2.00 USDC · Venice-only",
        "authority",
      );

      step = "x402";
      setVeniceActive(true);
      pushLog("Venice inference via x402 delegated payment…", "default");

      const specialist = getSpecialistAccount(hireResult.hired.role);
      const venice = await runVeniceViaX402({
        specialistAccount: specialist,
        redelegatedContext: hireResult.redelegation.permissionContext,
        contractorAddress: contractor.address,
      });

      if (!venice.settlementTx) {
        throw new Error("x402 settlement tx missing — payment may not have settled on-chain");
      }

      setVeniceOutput(venice.content);
      setVeniceActive(false);
      pushLog(
        `x402 settled · ${venice.settlementTx.slice(0, 10)}…`,
        "default",
        `${explorerTxUrl}/${venice.settlementTx}`,
      );

      step = "feedback";
      const runNumber = runCount + 1;
      const feedback = await writeSettlementFeedback({
        contractor,
        hired: hireResult.hired,
        settlementTxHash: venice.settlementTx,
        runNumber,
      });

      const delta = Math.round(feedback.scoreAfter - feedback.scoreBefore);
      setScoreDeltaFlash({ agentId: hireResult.hired.agentId, delta });
      await animateScore(
        hireResult.hired.agentId,
        feedback.scoreBefore,
        feedback.scoreAfter,
      );

      pushLog(
        `Feedback ${feedback.feedbackScore} on-chain · ${hireResult.hired.name} ${feedback.scoreBefore.toFixed(2)} → ${feedback.scoreAfter.toFixed(2)}`,
        "reputation",
        `${explorerTxUrl}/${feedback.feedbackTxHash}`,
      );

      step = "reputation-refresh";
      const updatedCandidates = await listSpecialistCandidates({
        contractorAddress,
        requiredCapability: VENICE_CAPABILITY,
      });
      setLiveAgents(mapLiveAgents(registeredAgents, updatedCandidates));

      pushLog(
        `Updated standings: ${updatedCandidates.map((c) => `${c.name} ${c.score.toFixed(2)}`).join(" · ")}`,
        "reputation",
      );

      const refreshed = updatedCandidates.find(
        (c) => c.role === hireResult.hired.role,
      );
      if (refreshed) setHiredSpecialist(refreshed);

      setRunCount(runNumber);
      showToast(
        `${hireResult.hired.name} complete — score ${feedback.scoreAfter.toFixed(2)}`,
      );
      window.setTimeout(() => setScoreDeltaFlash(null), 2200);
    } catch (err) {
      setVeniceActive(false);
      const message = formatJobError(err, step);
      pushLog(message, "revert");
      showToast(message);
    } finally {
      setIsRunning(false);
    }
  }, [
    animateScore,
    busy,
    contractorAddress,
    hiredSpecialist,
    isRunning,
    permission,
    pushLog,
    registeredAgents,
    runCount,
    showToast,
  ]);

  const attemptOverspend = useCallback(async () => {
    if (!hiredSpecialist || !redelegation || isRunning || busy !== null) return;

    pushLog(
      `${hiredSpecialist.name} attempts 3.00 USDC transfer against 2.00 USDC cap…`,
      "default",
    );

    try {
      const contractor = getOrCreateContractorAccount();
      const specialist = getSpecialistAccount(hiredSpecialist.role);
      const { delegationProvider } = buildSpecialistX402Client({
        specialistAccount: specialist,
        redelegatedContext: redelegation.permissionContext,
        contractorAddress: contractor.address,
      });

      const paymentPayload = await delegationProvider({
        scheme: "exact",
        network: "eip155:84532",
        asset: addresses.usdc,
        amount: OVERSPEND_AMOUNT.toString(),
        payTo: specialist.address,
        maxTimeoutSeconds: 300,
      });

      const specialistWalletClient = createWalletClient({
        account: specialist,
        chain,
        transport: getGuildHttpTransport(),
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

      pushLog(
        "[overspend] Expected over-cap redemption to revert, but transfer succeeded.",
        "revert",
      );
    } catch (err) {
      pushLog(formatJobError(err, "overspend"), "revert");
    }
  }, [busy, hiredSpecialist, isRunning, pushLog, redelegation]);

  return {
    agents,
    hiredAgent,
    hiredId,
    runCount,
    logLines,
    veniceOutput,
    veniceActive,
    isRunning,
    scoreDeltaFlash,
    eligibleCount,
    displayScore,
    registry,
    registryLoading,
    walletAddress,
    contractorAddress,
    permission,
    permissionGranted: Boolean(permission),
    registeredAgents,
    workflowStep,
    busy,
    toast,
    selectedAgentId,
    setSelectedAgentId,
    mode: "live" as const,
    connectWallet,
    grantBudget,
    registerAgents,
    postJobAndHire,
    attemptOverspend,
    primaryLabel: runCount === 0 ? "Post job & hire" : "Run again",
    canOverspend: hiredId !== null && redelegation !== null && !isRunning && busy === null,
    registryDeployed: Boolean(
      registry?.identityDeployed && registry?.reputationDeployed,
    ),
  };
}
