import { getGuildChainConfig, getRelayerRpcUrl } from "@guild/core/chain-mode";
import { getStatus, type RelayerStatusResponse } from "@guild/core/relayer";
import type { RelayerLiveEvent } from "@/lib/relayer-event-bus";
import { formatJobError } from "@/lib/job-errors";
import { isRelayerMode } from "@/lib/relayer-mode";
import {
  submitSpecialistVeniceRelay,
  type RelayerSubmitTarget,
} from "@/lib/specialist-relayer";
import type { Hex } from "viem";
import type { PrivateKeyAccount } from "viem/accounts";
import { chainMode, chainId } from "@guild/core/config";

const MAINNET_RELAYER_URL = getRelayerRpcUrl("mainnet");
const SETTLEMENT_TIMEOUT_MS = 120_000;

function assertRelayerPrerequisites() {
  if (!isRelayerMode()) return;
  const mainnet = getGuildChainConfig("mainnet");
  if (chainMode !== "mainnet" || chainId !== mainnet.chainId) {
    throw new Error(
      "[relayer] Set CHAIN_MODE=mainnet and NEXT_PUBLIC_CHAIN_MODE=mainnet — mainnet relayer requires mainnet delegations",
    );
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!appUrl || appUrl.includes("localhost")) {
    throw new Error(
      "[relayer] Set NEXT_PUBLIC_APP_URL to a public tunnel (ngrok) so 1Shot can POST /api/relayer-webhook",
    );
  }
}

export function getMainnetRelayerTarget(): RelayerSubmitTarget {
  const mainnet = getGuildChainConfig("mainnet");
  return {
    relayerUrl: MAINNET_RELAYER_URL,
    chainId: mainnet.chainId,
    chain: mainnet.chain,
    usdc: mainnet.usdc,
    explorerTxUrl: mainnet.explorerTxUrl,
    rpcUrl:
      process.env.NEXT_PUBLIC_BASE_RPC_URL ??
      mainnet.chain.rpcUrls.default.http[0],
  };
}

async function waitForRelayerWebhook(
  taskId: string,
  onStatus?: (label: string, txHash?: string) => void,
): Promise<`0x${string}`> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const es = new EventSource(
      `/api/relayer-events?taskId=${encodeURIComponent(taskId)}`,
    );

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      es.close();
      fn();
    };

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const status = await getStatus(
            taskId as `0x${string}`,
            true,
            MAINNET_RELAYER_URL,
          );
          onStatus?.(
            `Fallback getStatus · ${statusLabel(status.status)}`,
            status.receipt?.transactionHash ?? status.hash,
          );
          const tx =
            status.receipt?.transactionHash ?? status.hash;
          if (status.status === 200 && tx) {
            finish(() => resolve(tx as `0x${string}`));
            return;
          }
          finish(() =>
            reject(
              new Error(
                `Relayer webhook timeout — last status ${status.status}${status.message ? `: ${status.message}` : ""}`,
              ),
            ),
          );
        } catch (err) {
          finish(() => reject(err));
        }
      })();
    }, SETTLEMENT_TIMEOUT_MS);

    es.onmessage = (message) => {
      let event: RelayerLiveEvent;
      try {
        event = JSON.parse(message.data) as RelayerLiveEvent;
      } catch {
        return;
      }

      onStatus?.(
        `1Shot webhook · ${event.label}`,
        event.transactionHash ?? event.hash,
      );

      if (event.status === 200 && event.transactionHash) {
        finish(() => resolve(event.transactionHash as `0x${string}`));
      } else if (event.status === 400 || event.status === 500) {
        finish(() =>
          reject(new Error(`Relayer failed · ${event.label}`)),
        );
      }
    };

    es.onerror = () => {
      /* SSE may reconnect; fallback timer handles hard timeout */
    };
  });
}

function statusLabel(status: RelayerStatusResponse["status"]): string {
  switch (status) {
    case 100:
      return "Pending";
    case 110:
      return "Submitted";
    case 200:
      return "Confirmed";
    case 400:
      return "Rejected";
    case 500:
      return "Reverted";
    default:
      return `Status ${status}`;
  }
}

async function fetchVeniceAfterSettlement(): Promise<string> {
  const response = await fetch("/api/venice", { method: "POST" });
  const data = (await response.json()) as { content?: string; error?: string };
  if (!response.ok || !data.content) {
    throw new Error(data.error ?? `Venice inference failed (${response.status})`);
  }
  return data.content;
}

/** Mainnet 1Shot relayer settlement + Venice inference (no x402 client). */
export async function runVeniceViaRelayer(params: {
  specialistAccount: PrivateKeyAccount;
  redelegatedContext: Hex;
  onRelayerStatus?: (label: string, txHash?: string) => void;
  memo?: string;
}): Promise<{ content: string; settlementTx: `0x${string}`; taskId: `0x${string}` }> {
  assertRelayerPrerequisites();
  const target = getMainnetRelayerTarget();

  let relay;
  try {
    relay = await submitSpecialistVeniceRelay(
      {
        specialistAccount: params.specialistAccount,
        redelegatedContext: params.redelegatedContext,
        memo: params.memo,
      },
      target,
    );
  } catch (err) {
    throw new Error(formatJobError(err, "relayer-send"));
  }

  params.onRelayerStatus?.(
    `Task submitted · ${relay.taskId.slice(0, 10)}… (fee ${relay.feeAmount} / work ${relay.workAmount} USDC units)`,
  );

  let settlementTx: `0x${string}`;
  try {
    settlementTx = await waitForRelayerWebhook(
      relay.taskId,
      params.onRelayerStatus,
    );
  } catch (err) {
    throw new Error(formatJobError(err, "relayer-webhook"));
  }

  let content: string;
  try {
    content = await fetchVeniceAfterSettlement();
  } catch (err) {
    throw new Error(formatJobError(err, "relayer-venice"));
  }

  return {
    content,
    settlementTx,
    taskId: relay.taskId,
  };
}
