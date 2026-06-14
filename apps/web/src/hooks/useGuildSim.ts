"use client";

import { useCallback, useMemo, useState } from "react";
import {
  JOB_CAPABILITY,
  MOCK_VENICE_OUTPUT,
  SEED_AGENTS,
  type Agent,
  type LogLine,
  type LogVariant,
} from "@/lib/guild-sim/types";

function nowStamp() {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sortByScore(agents: Agent[]) {
  return [...agents].sort((a, b) => b.score - a.score);
}

function getEligible(agents: Agent[]) {
  return agents.filter((a) => a.capability === JOB_CAPABILITY);
}

function getTopEligible(agents: Agent[]) {
  const eligible = getEligible(agents);
  return [...eligible].sort((a, b) => b.score - a.score)[0] ?? null;
}

function planRun(runIndex: number): {
  delta: number;
  validation: string;
  validationVariant: LogVariant;
} {
  if (runIndex === 1) {
    return {
      delta: -24,
      validation: "Validation · partial coverage",
      validationVariant: "revert",
    };
  }
  if (runIndex === 2) {
    return {
      delta: 20,
      validation: "Validation · verified",
      validationVariant: "reputation",
    };
  }
  const magnitude = 8 + Math.floor(Math.random() * 15);
  const sign = Math.random() > 0.5 ? 1 : -1;
  return {
    delta: sign * magnitude,
    validation: sign > 0 ? "Validation · verified" : "Validation · partial coverage",
    validationVariant: sign > 0 ? "reputation" : "revert",
  };
}

export type ScoreDeltaFlash = {
  agentId: string;
  delta: number;
} | null;

export function useGuildSim() {
  const [agents, setAgents] = useState<Agent[]>(() => sortByScore(SEED_AGENTS));
  const [hiredId, setHiredId] = useState<string | null>(null);
  const [runCount, setRunCount] = useState(0);
  const [logLines, setLogLines] = useState<LogLine[]>([]);
  const [veniceOutput, setVeniceOutput] = useState<string | null>(null);
  const [veniceActive, setVeniceActive] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [overspendShake, setOverspendShake] = useState(false);
  const [scoreDeltaFlash, setScoreDeltaFlash] = useState<ScoreDeltaFlash>(null);
  const [animatingScores, setAnimatingScores] = useState<Record<string, number>>({});

  const hiredAgent = useMemo(
    () => agents.find((a) => a.id === hiredId) ?? null,
    [agents, hiredId],
  );

  const eligibleCount = useMemo(
    () => getEligible(agents).length,
    [agents],
  );

  const pushLog = useCallback((text: string, variant: LogVariant = "default") => {
    setLogLines((lines) => [
      ...lines,
      {
        id: `${Date.now()}-${lines.length}`,
        text,
        variant,
        timestamp: nowStamp(),
      },
    ]);
  }, []);

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

  const postJobAndHire = useCallback(async () => {
    if (isRunning) return;
    setIsRunning(true);
    setVeniceOutput(null);
    setScoreDeltaFlash(null);

    // INTEGRATE: ERC-8004 ReputationRegistry read → standings
    // INTEGRATE: ranking read → hire selection (replaces topEligible mock)
    const top = getTopEligible(agents);
    if (!top) {
      setIsRunning(false);
      return;
    }

    const runIndex = runCount + 1;
    const eligibleNames = getEligible(agents)
      .sort((a, b) => b.score - a.score)
      .map((a) => a.name)
      .join(", ");

    setHiredId(top.id);

    await sleep(280);
    pushLog("Reading ERC-8004 reputation registry…", "reputation");
    await sleep(420);
    pushLog(`Eligible · ${JOB_CAPABILITY}: ${eligibleNames}`, "default");
    await sleep(380);
    pushLog(
      `Hired ${top.name} (score ${top.score}) — top of capability`,
      "authority",
    );
    await sleep(400);

    // INTEGRATE: createDelegation attenuated (spending-limit + allowedTargets=Venice) → specialist rung
    pushLog(
      "Contractor redelegates · attenuated to 2.00 USDC · Venice-only",
      "authority",
    );
    await sleep(450);

    setVeniceActive(true);
    // INTEGRATE: Venice /chat/completions via x402 wrapFetchWithPayment → Venice card
    pushLog("Paid 0.04 USDC · Venice private inference", "default");
    await sleep(600);
    setVeniceOutput(MOCK_VENICE_OUTPUT);
    setVeniceActive(false);
    await sleep(350);

    const { delta, validation, validationVariant } = planRun(runIndex);
    pushLog(validation, validationVariant);
    await sleep(400);

    const newScore = Math.max(0, top.score + delta);
    setScoreDeltaFlash({ agentId: top.id, delta });
    await animateScore(top.id, top.score, newScore);

    setAgents((current) => {
      const updated = current.map((a) =>
        a.id === top.id
          ? {
              ...a,
              score: newScore,
              jobsCompleted: a.jobsCompleted + 1,
            }
          : a,
      );
      return sortByScore(updated);
    });

    await sleep(200);
    pushLog(
      `Wrote feedback to registry → ${top.name} now ${newScore}`,
      "reputation",
    );
    await sleep(380);

    // INTEGRATE: 1Shot relayer_send7710Transaction + webhook → "Settled" line
    pushLog("Settled via 1Shot relayer · gas in USDC ✓", "default");

    setRunCount(runIndex);
    setIsRunning(false);

    window.setTimeout(() => setScoreDeltaFlash(null), 2200);
  }, [agents, animateScore, isRunning, pushLog, runCount]);

  const attemptOverspend = useCallback(async () => {
    if (!hiredAgent || isRunning) return;

    pushLog(
      `${hiredAgent.name} attempts 5.00 USDC spend against 2.00 USDC cap…`,
      "default",
    );
    await sleep(400);
    pushLog(
      "Reverted at caveat. Cap is 2.00 USDC — authority can only attenuate.",
      "revert",
    );
    setOverspendShake(true);
    window.setTimeout(() => setOverspendShake(false), 500);
  }, [hiredAgent, isRunning, pushLog]);

  const displayScore = useCallback(
    (agent: Agent) => animatingScores[agent.id] ?? agent.score,
    [animatingScores],
  );

  return {
    agents,
    hiredAgent,
    hiredId,
    runCount,
    logLines,
    veniceOutput,
    veniceActive,
    isRunning,
    overspendShake,
    scoreDeltaFlash,
    eligibleCount,
    displayScore,
    postJobAndHire,
    attemptOverspend,
    primaryLabel: runCount === 0 ? "Post job & hire" : "Run again",
    canOverspend: hiredId !== null && !isRunning,
  };
}
