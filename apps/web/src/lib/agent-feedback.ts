import { addresses, chain, chainId, publicClient } from "@guild/core/config";
import {
  agentRegistryUri,
  readReputationSummary,
  writeAgentFeedback,
} from "@guild/core/identity";
import type { Account, Hash } from "viem";
import {
  FIRST_RUN_FEEDBACK_SCORE,
  LATER_RUN_FEEDBACK_SCORE,
  REPUTATION_TAG1,
  VENICE_CAPABILITY,
} from "@/lib/agents";
import type { SpecialistCandidate } from "@/lib/agent-hiring";
import { createContractorWalletClient } from "@/lib/contractor-wallet";
import { formatJobError } from "@/lib/job-errors";

function getAppOrigin(): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    (typeof window !== "undefined" ? window.location.origin : "");
  if (!base) throw new Error("Set NEXT_PUBLIC_APP_URL for feedback files");
  return base.replace(/\/$/, "");
}

/**
 * First-run feedback intentionally scores below the runner-up seed so
 * getSummary drops the leader and run 2 hires a different specialist.
 */
export async function writeSettlementFeedback(params: {
  contractor: Account;
  hired: SpecialistCandidate;
  settlementTxHash: `0x${string}`;
  runNumber: number;
}): Promise<{
  feedbackTxHash: Hash;
  feedbackURI: string;
  scoreBefore: number;
  scoreAfter: number;
  feedbackScore: number;
}> {
  const scoreBefore = (
    await readReputationSummary({
      agentId: BigInt(params.hired.agentId),
      clientAddresses: [params.contractor.address],
      tag1: REPUTATION_TAG1,
      tag2: VENICE_CAPABILITY,
    })
  ).score;

  const feedbackScore =
    params.runNumber === 1 ? FIRST_RUN_FEEDBACK_SCORE : LATER_RUN_FEEDBACK_SCORE;
  const feedbackValue = BigInt(Math.round(feedbackScore * 100));

  const feedbackId = `${params.hired.agentId}-${params.settlementTxHash.slice(2, 10)}`;
  const feedbackURI = `${getAppOrigin()}/api/agents/feedback/${feedbackId}`;

  const feedbackPayload = JSON.stringify({
    type: "https://eips.ethereum.org/EIPS/eip-8004#feedback-v1",
    agentRegistry: agentRegistryUri(chainId, addresses.identityRegistry),
    agentId: params.hired.agentId,
    clientAddress: params.contractor.address,
    createdAt: new Date().toISOString(),
    value: feedbackScore,
    valueDecimals: 2,
    tag1: REPUTATION_TAG1,
    tag2: VENICE_CAPABILITY,
    endpoint: "/api/x402/venice-inference",
    paymentProof: {
      scheme: "exact",
      network: `eip155:${chainId}`,
      asset: addresses.usdc,
      txHash: params.settlementTxHash,
    },
    runNumber: params.runNumber,
  });

  const storeRes = await fetch("/api/agents/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: feedbackId,
      payload: JSON.parse(feedbackPayload),
    }),
  });

  if (!storeRes.ok) {
    const body = await storeRes.text();
    throw new Error(
      formatJobError(
        new Error(`feedback file store failed (${storeRes.status}): ${body}`),
        "feedback-store",
      ),
    );
  }

  let feedbackTxHash: Hash;
  try {
    const wallet = createContractorWalletClient();
    feedbackTxHash = await writeAgentFeedback({
      account: params.contractor,
      chain,
      agentId: BigInt(params.hired.agentId),
      value: feedbackValue,
      valueDecimals: 2,
      tag1: REPUTATION_TAG1,
      tag2: VENICE_CAPABILITY,
      endpoint: "/api/x402/venice-inference",
      feedbackURI,
      feedbackPayload,
      client: wallet,
    });
  } catch (err) {
    throw new Error(formatJobError(err, "feedback-tx"));
  }

  await publicClient.waitForTransactionReceipt({ hash: feedbackTxHash });

  const scoreAfter = (
    await readReputationSummary({
      agentId: BigInt(params.hired.agentId),
      clientAddresses: [params.contractor.address],
      tag1: REPUTATION_TAG1,
      tag2: VENICE_CAPABILITY,
    })
  ).score;

  return {
    feedbackTxHash,
    feedbackURI,
    scoreBefore,
    scoreAfter,
    feedbackScore,
  };
}
