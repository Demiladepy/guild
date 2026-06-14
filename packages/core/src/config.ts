import { createPublicClient, http, type Chain } from "viem";
import {
  createBundlerClient,
  entryPoint07Address,
} from "viem/account-abstraction";
import { getGuildChainConfig, type ChainMode } from "./chain-mode";

const guildChain = getGuildChainConfig();

/** Active viem chain — Base Sepolia (testnet) or Base (mainnet) per CHAIN_MODE. */
export const chain: Chain = guildChain.chain;

/** Active chain id. */
export const chainId = guildChain.chainId;

/** Active chain mode. */
export const chainMode: ChainMode = guildChain.mode;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string): string | undefined {
  return process.env[name];
}

export const publicClient = createPublicClient({
  chain,
  transport: http(
    optionalEnv("BASE_SEPOLIA_RPC_URL") ??
      optionalEnv("BASE_RPC_URL") ??
      chain.rpcUrls.default.http[0],
  ),
});

/** ERC-4337 v0.7 entrypoint — ensure your bundler RPC targets this contract. */
export const entryPoint = entryPoint07Address;

/**
 * Factory for an ERC-4337 v0.7 bundler client.
 * `BUNDLER_RPC_URL` must point to a bundler that supports entryPoint v0.7.
 */
export function createGuildBundlerClient() {
  const bundlerUrl = requireEnv("BUNDLER_RPC_URL");

  return createBundlerClient({
    client: publicClient,
    chain,
    transport: http(bundlerUrl),
  });
}

export const addresses = {
  /** USDC for the active chain (Circle). */
  usdc: guildChain.usdc,

  x402FacilitatorUrl: guildChain.x402FacilitatorUrl,

  /** 1Shot relayer JSON-RPC — skill uses .dev for testnet chains. */
  relayerRpcUrl: guildChain.relayerRpcUrl,

  /** Venice x402 + inference paths (HTTP scope for Specialist redelegation). */
  veniceX402TopUp: "/x402/top-up" as const,
  veniceChatCompletions: "/chat/completions" as const,

  /** ERC-8004 IdentityRegistry — verified erc-8004/erc-8004-contracts README */
  identityRegistry: guildChain.identityRegistry,

  /** ERC-8004 ReputationRegistry — verified erc-8004/erc-8004-contracts README */
  reputationRegistry: guildChain.reputationRegistry,
} as const;

export const explorerTxUrl = guildChain.explorerTxUrl;
export const explorerNftUrl = guildChain.explorerNftUrl;

export const venice = {
  baseURL: "https://api.venice.ai/api/v1",
  get model() {
    return requireEnv("VENICE_MODEL");
  },
  get apiKey() {
    return requireEnv("VENICE_API_KEY");
  },
} as const;

/** Delegation caps for the Guild demo tree (USDC, 6 decimals). */
export const delegationCaps = {
  userWeekly: 10n,
  contractorWeekly: 10n,
  specialistTotal: 2n,
} as const;
