/**
 * Minimal viem bindings for ERC-8004 registries.
 * ABIs trimmed from https://github.com/erc-8004/erc-8004-contracts/tree/master/abis
 */
import {
  type Account,
  type Chain,
  type Hash,
  type Hex,
  type PublicClient,
  type WalletClient,
  createWalletClient,
  http,
  keccak256,
  parseAbi,
  parseEventLogs,
  stringToHex,
} from "viem";
import { getGuildChainConfig } from "./chain-mode";
import { publicClient } from "./config";

/** ABI source: abis/IdentityRegistry.json */
export const identityRegistryAbi = parseAbi([
  "function register(string agentURI) returns (uint256 agentId)",
  "function register() returns (uint256 agentId)",
  "function setAgentURI(uint256 agentId, string newURI)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function getAgentWallet(uint256 agentId) view returns (address)",
  "function balanceOf(address owner) view returns (uint256)",
  "event Registered(uint256 indexed agentId, string agentURI, address indexed owner)",
]);

/** ABI source: abis/ReputationRegistry.json */
export const reputationRegistryAbi = parseAbi([
  "function giveFeedback(uint256 agentId, int128 value, uint8 valueDecimals, string tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash)",
  "function getSummary(uint256 agentId, address[] clientAddresses, string tag1, string tag2) view returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals)",
  "function readFeedback(uint256 agentId, address clientAddress, uint64 feedbackIndex) view returns (int128 value, uint8 valueDecimals, string tag1, string tag2, bool isRevoked)",
  "function getLastIndex(uint256 agentId, address clientAddress) view returns (uint64)",
  "function getIdentityRegistry() view returns (address)",
]);

export type Erc8004Addresses = {
  identityRegistry: `0x${string}`;
  reputationRegistry: `0x${string}`;
};

export function getErc8004Addresses(): Erc8004Addresses {
  const cfg = getGuildChainConfig();
  return {
    identityRegistry: cfg.identityRegistry,
    reputationRegistry: cfg.reputationRegistry,
  };
}

export function agentRegistryUri(chainId: number, identityRegistry: `0x${string}`) {
  return `eip155:${chainId}:${identityRegistry}`;
}

export function formatReputationScore(
  summaryValue: bigint,
  summaryValueDecimals: number,
): number {
  if (summaryValueDecimals === 0) return Number(summaryValue);
  return Number(summaryValue) / 10 ** summaryValueDecimals;
}

export async function registerAgent(params: {
  account: Account;
  agentURI: string;
  chain: Chain;
  client?: WalletClient;
}): Promise<{ agentId: bigint; hash: Hash }> {
  const { identityRegistry } = getErc8004Addresses();
  const wallet =
    params.client ??
    createWalletClient({
      account: params.account,
      chain: params.chain,
      transport: http(),
    });

  const hash = await wallet.writeContract({
    address: identityRegistry,
    abi: identityRegistryAbi,
    functionName: "register",
    args: [params.agentURI],
    account: params.account,
    chain: params.chain,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const registered = parseEventLogs({
    abi: identityRegistryAbi,
    logs: receipt.logs,
    eventName: "Registered",
  })[0];

  if (!registered) {
    throw new Error("IdentityRegistry Registered event not found");
  }

  return { agentId: registered.args.agentId, hash };
}

export async function readAgentOwner(agentId: bigint): Promise<`0x${string}`> {
  const { identityRegistry } = getErc8004Addresses();
  return publicClient.readContract({
    address: identityRegistry,
    abi: identityRegistryAbi,
    functionName: "ownerOf",
    args: [agentId],
  });
}

export async function readAgentTokenUri(agentId: bigint): Promise<string> {
  const { identityRegistry } = getErc8004Addresses();
  return publicClient.readContract({
    address: identityRegistry,
    abi: identityRegistryAbi,
    functionName: "tokenURI",
    args: [agentId],
  });
}

export async function readReputationSummary(params: {
  agentId: bigint;
  clientAddresses: `0x${string}`[];
  tag1: string;
  tag2: string;
  client?: PublicClient;
}): Promise<{
  count: bigint;
  summaryValue: bigint;
  summaryValueDecimals: number;
  score: number;
}> {
  const { reputationRegistry } = getErc8004Addresses();
  const reader = params.client ?? publicClient;
  const [count, summaryValue, summaryValueDecimals] =
    await reader.readContract({
      address: reputationRegistry,
      abi: reputationRegistryAbi,
      functionName: "getSummary",
      args: [
        params.agentId,
        params.clientAddresses,
        params.tag1,
        params.tag2,
      ],
    });

  return {
    count,
    summaryValue,
    summaryValueDecimals: Number(summaryValueDecimals),
    score: formatReputationScore(summaryValue, Number(summaryValueDecimals)),
  };
}

export function hashFeedbackPayload(payload: string): Hex {
  return keccak256(stringToHex(payload));
}

export async function writeAgentFeedback(params: {
  account: Account;
  chain: Chain;
  agentId: bigint;
  value: bigint;
  valueDecimals: number;
  tag1: string;
  tag2: string;
  endpoint: string;
  feedbackURI: string;
  feedbackPayload: string;
  client?: WalletClient;
}): Promise<Hash> {
  const { reputationRegistry } = getErc8004Addresses();
  const wallet =
    params.client ??
    createWalletClient({
      account: params.account,
      chain: params.chain,
      transport: http(),
    });

  return wallet.writeContract({
    address: reputationRegistry,
    abi: reputationRegistryAbi,
    functionName: "giveFeedback",
    args: [
      params.agentId,
      params.value,
      params.valueDecimals,
      params.tag1,
      params.tag2,
      params.endpoint,
      params.feedbackURI,
      hashFeedbackPayload(params.feedbackPayload),
    ],
    account: params.account,
    chain: params.chain,
  });
}
