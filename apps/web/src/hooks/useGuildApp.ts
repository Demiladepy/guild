"use client";

import { addresses, chain, explorerNftUrl } from "@guild/core/config";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createWalletClient, custom, parseUnits } from "viem";
import { erc7715ProviderActions } from "@metamask/smart-accounts-kit/actions";
import type { GetGrantedExecutionPermissionsResult } from "@metamask/smart-accounts-kit/actions";
import { registerGuildAgents, type RegisteredGuildAgent } from "@/lib/agent-registry";
import { hireTopSpecialist, listSpecialistCandidates } from "@/lib/agent-hiring";
import {
  GUILD_AGENT_DEFINITIONS,
  type SpecialistRole,
} from "@/lib/agents";
import { getOrCreateContractorAccount } from "@/lib/session-account";
import { verifyRegistriesDeployed, type RegistryStatus } from "@/lib/verify-registry";
import { useGuildSim } from "@/hooks/useGuildSim";
import type { Agent, Capability } from "@/lib/guild-sim/types";

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

function mapLiveAgents(
  registered: RegisteredGuildAgent[],
  scores: Awaited<ReturnType<typeof listSpecialistCandidates>>,
): Agent[] {
  return registered.map((r) => {
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
}

export function useGuildApp() {
  const sim = useGuildSim();
  const [registry, setRegistry] = useState<RegistryStatus | null>(null);
  const [registryLoading, setRegistryLoading] = useState(true);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [contractorAddress, setContractorAddress] = useState<`0x${string}` | null>(null);
  const [permission, setPermission] = useState<GrantedPermission | null>(null);
  const [registeredAgents, setRegisteredAgents] = useState<RegisteredGuildAgent[]>([]);
  const [liveAgents, setLiveAgents] = useState<Agent[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [mode, setMode] = useState<"demo" | "live">("demo");

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 4000);
  }, []);

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

  const agents = mode === "live" && liveAgents ? liveAgents : sim.agents;
  const hiredId = sim.hiredId;
  const displayScore = sim.displayScore;

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
      setMode("live");
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
        });
        setLiveAgents(mapLiveAgents(specialists, candidates));
      }
      showToast(`Registered ${specialists.length} ERC-8004 agents on-chain`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(null);
    }
  }, [contractorAddress, showToast]);

  const postJobAndHire = useCallback(async () => {
    if (mode === "live" && permission && contractorAddress && registeredAgents.length > 0) {
      setBusy("hire");
      try {
        const contractor = getOrCreateContractorAccount();
        const result = await hireTopSpecialist({
          contractorAccount: contractor,
          contractorAddress,
          parentPermission: permission,
        });
        showToast(`Hired ${result.hired.name} · score ${result.hired.score.toFixed(0)}`);
        setLiveAgents(
          mapLiveAgents(
            registeredAgents,
            result.candidates,
          ),
        );
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Hire failed");
        setBusy(null);
        return;
      }
      setBusy(null);
    }
    await sim.postJobAndHire();
  }, [
    mode,
    permission,
    contractorAddress,
    registeredAgents,
    sim,
    showToast,
  ]);

  return {
    ...sim,
    agents,
    hiredId,
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
    mode,
    setMode,
    connectWallet,
    grantBudget,
    registerAgents,
    postJobAndHire,
    registryDeployed: Boolean(
      registry?.identityDeployed && registry?.reputationDeployed,
    ),
  };
}
