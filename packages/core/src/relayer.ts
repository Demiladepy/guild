import { bytesToHex } from "viem/utils";
import { getGuildChainConfig, getRelayerRpcUrl } from "./chain-mode";

type JsonRpcSuccess<T> = { jsonrpc: "2.0"; id: number | string; result: T };
type JsonRpcError = {
  jsonrpc: "2.0";
  id: number | string;
  error: { code: number; message: string; data?: unknown };
};
type JsonRpcResponse<T> = JsonRpcSuccess<T> | JsonRpcError;

export type RelayerToken = {
  address: `0x${string}`;
  symbol?: string;
  name?: string;
  decimals: number | string;
};

export type ChainCapabilities = {
  feeCollector: `0x${string}`;
  targetAddress: `0x${string}`;
  tokens: RelayerToken[];
};

export type GetCapabilitiesResult = Record<string, ChainCapabilities>;

export type GetFeeDataParams = {
  chainId: string;
  token: `0x${string}`;
};

export type GetFeeDataResult = {
  chainId: string;
  token: RelayerToken & { decimals: number };
  rate: number;
  minFee: string;
  expiry: number;
  gasPrice: `0x${string}`;
  feeCollector: `0x${string}`;
  targetAddress?: `0x${string}`;
  context?: string;
};

export type Execution7710 = {
  target: `0x${string}`;
  value: string;
  data: `0x${string}`;
};

export type Delegation7710 = {
  delegate: `0x${string}`;
  delegator: `0x${string}`;
  authority: string;
  caveats: Array<{ enforcer: `0x${string}`; terms: string; args: string }>;
  salt: string;
  signature: string;
};

export type AuthorizationListEntry = {
  address: `0x${string}`;
  chainId: number | string;
  nonce: number | string;
  r: `0x${string}`;
  s: `0x${string}`;
  yParity: number | string;
};

export type Send7710TransactionParams = {
  chainId: string;
  transactions: Array<{
    permissionContext: Delegation7710[];
    executions: Execution7710[];
  }>;
  authorizationList?: AuthorizationListEntry[];
  context?: string;
  taskId?: `0x${string}`;
  destinationUrl?: string;
  memo?: string;
};

export type Estimate7710Result = {
  success: boolean;
  paymentTokenAddress?: `0x${string}`;
  paymentChain?: number;
  gasUsed: Record<string, string>;
  requiredPaymentAmount?: string;
  context?: string;
  contextByChainId?: Record<string, string>;
  error?: string;
};

export type RelayerStatusResponse = {
  id: `0x${string}`;
  chainId: string;
  createdAt: number;
  status: 100 | 110 | 200 | 400 | 500;
  memo?: string;
  hash?: string;
  receipt?: {
    blockHash: string;
    blockNumber: string;
    gasUsed: string;
    transactionHash: string;
    logs?: unknown[];
  };
  message?: string;
  data?: unknown;
};

let requestId = 0;

async function relayerRpc<T>(
  method: string,
  params: unknown,
  relayerUrl: string = getRelayerRpcUrl(),
): Promise<T> {
  const response = await fetch(relayerUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: ++requestId,
      method,
      params,
    }),
  });

  const json = (await response.json()) as JsonRpcResponse<T>;
  if (!response.ok) {
    throw new Error(`Relayer HTTP ${response.status}: ${JSON.stringify(json)}`);
  }
  if ("error" in json) {
    throw new Error(
      `[${json.error.code}] ${json.error.message} ${JSON.stringify(json.error.data ?? "")}`,
    );
  }
  return json.result;
}

/** Convert delegation bigints / byte arrays into JSON-safe relayer shapes. */
export function toRelayerJson(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "bigint") return `0x${value.toString(16)}`;
  if (value instanceof Uint8Array) return bytesToHex(value);
  if (Array.isArray(value)) return value.map(toRelayerJson);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = toRelayerJson(val);
    }
    return out;
  }
  return value;
}

/** Call FIRST — confirms supported chains and accepted stablecoin gas tokens. */
export async function getCapabilities(
  chainIds?: string[],
  relayerUrl?: string,
): Promise<GetCapabilitiesResult> {
  const ids = chainIds ?? [String(getGuildChainConfig().chainId)];
  return relayerRpc<GetCapabilitiesResult>(
    "relayer_getCapabilities",
    ids,
    relayerUrl,
  );
}

/** Returns locked fee context — pass verbatim as `context` on send7710. */
export async function getFeeData(
  params: GetFeeDataParams,
  relayerUrl?: string,
): Promise<GetFeeDataResult> {
  return relayerRpc<GetFeeDataResult>(
    "relayer_getFeeData",
    params,
    relayerUrl,
  );
}

export async function estimate7710(
  params: Send7710TransactionParams,
  relayerUrl?: string,
): Promise<Estimate7710Result> {
  return relayerRpc<Estimate7710Result>(
    "relayer_estimate7710Transaction",
    params,
    relayerUrl,
  );
}

/** Same-chain fee + execution via 1Shot relayer. */
export async function send7710(
  params: Send7710TransactionParams,
  relayerUrl?: string,
): Promise<`0x${string}`> {
  return relayerRpc<`0x${string}`>(
    "relayer_send7710Transaction",
    params,
    relayerUrl,
  );
}

/** Polling fallback only — prefer webhooks via destinationUrl. */
export async function getStatus(
  taskId: `0x${string}`,
  logs = false,
  relayerUrl?: string,
): Promise<RelayerStatusResponse> {
  return relayerRpc<RelayerStatusResponse>(
    "relayer_getStatus",
    { id: taskId, logs },
    relayerUrl,
  );
}
