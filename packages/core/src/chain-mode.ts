import { base, baseSepolia, type Chain } from "viem/chains";

export type ChainMode = "testnet" | "mainnet";

export function getChainMode(): ChainMode {
  const raw =
    process.env.CHAIN_MODE ??
    process.env.NEXT_PUBLIC_CHAIN_MODE ??
    "testnet";
  if (raw !== "testnet" && raw !== "mainnet") {
    throw new Error(`Invalid CHAIN_MODE: ${raw} (expected testnet|mainnet)`);
  }
  return raw;
}

/** Per 1Shot skill: dev relayer for Base Sepolia; production relayer for mainnets. */
export function getRelayerRpcUrl(mode: ChainMode = getChainMode()): string {
  if (mode === "testnet") {
    // Skill: Sepolia + Base Sepolia use relayer.1shotapi.dev (not .com).
    return "https://relayer.1shotapi.dev/relayers";
  }
  return "https://relayer.1shotapi.com/relayers";
}

/**
 * ERC-8004 singleton registries — verified against
 * https://github.com/erc-8004/erc-8004-contracts README (2026-06).
 * Testnet chains share one vanity pair; mainnets share another.
 */
const ERC8004_TESTNET = {
  identityRegistry: "0x8004A818BFB912233c491871b3d84c89A494BD9e" as const,
  reputationRegistry: "0x8004B663056A597Dffe9eCcC1965A193B7388713" as const,
};

const ERC8004_MAINNET = {
  identityRegistry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as const,
  reputationRegistry: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63" as const,
};

export type GuildChainConfig = {
  mode: ChainMode;
  chain: Chain;
  chainId: number;
  usdc: `0x${string}`;
  explorerTxUrl: string;
  explorerNftUrl: string;
  relayerRpcUrl: string;
  x402FacilitatorUrl: string;
  identityRegistry: `0x${string}`;
  reputationRegistry: `0x${string}`;
};

export function getGuildChainConfig(
  mode: ChainMode = getChainMode(),
): GuildChainConfig {
  if (mode === "mainnet") {
    return {
      mode,
      chain: base,
      chainId: base.id,
      usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      explorerTxUrl: "https://basescan.org/tx",
      explorerNftUrl: `https://basescan.org/nft/${ERC8004_MAINNET.identityRegistry}`,
      relayerRpcUrl: getRelayerRpcUrl("mainnet"),
      x402FacilitatorUrl: "https://api.cdp.coinbase.com/platform/v2/x402",
      ...ERC8004_MAINNET,
    };
  }

  return {
    mode,
    chain: baseSepolia,
    chainId: baseSepolia.id,
    usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    explorerTxUrl: "https://sepolia.basescan.org/tx",
    explorerNftUrl: `https://sepolia.basescan.org/nft/${ERC8004_TESTNET.identityRegistry}`,
    relayerRpcUrl: getRelayerRpcUrl("testnet"),
    x402FacilitatorUrl: "https://x402.org/facilitator",
    ...ERC8004_TESTNET,
  };
}
