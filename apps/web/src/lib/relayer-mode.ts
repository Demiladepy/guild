export type RelayerMode = "x402" | "relayer";

/** Settlement transport — x402 (default) or 1Shot mainnet relayer. */
export function getRelayerMode(): RelayerMode {
  const raw =
    process.env.NEXT_PUBLIC_RELAYER_MODE ??
    process.env.RELAYER_MODE ??
    "x402";
  return raw === "relayer" ? "relayer" : "x402";
}

export function isRelayerMode(): boolean {
  return getRelayerMode() === "relayer";
}
