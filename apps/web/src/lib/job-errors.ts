import { decodeRevertReason } from "@metamask/smart-accounts-kit/utils";

export function formatJobError(err: unknown, step: string): string {
  const decoded = decodeRevertReason(err);
  const raw =
    decoded?.message ??
    (err instanceof Error ? err.message : String(err));
  const lower = raw.toLowerCase();

  if (
    lower.includes("insufficient") ||
    lower.includes("exceeds balance") ||
    lower.includes("transfer amount exceeds")
  ) {
    return `[${step}] Insufficient USDC — fund the owner wallet with USDC on Base Sepolia; ERC-7715 grant must cover inference (~$0.01) within the 2 USDC specialist cap`;
  }

  if (
    lower.includes("402") ||
    lower.includes("payment required") ||
    lower.includes("x402")
  ) {
    return `[${step}] x402 payment failed — confirm X402_PAYTO_ADDRESS, dev server restarted, specialist redelegation active, and x402.org facilitator reachable on Sepolia`;
  }

  if (
    lower.includes("relayer") ||
    lower.includes("7702") ||
    lower.includes("authorization") ||
    lower.includes("webhook timeout")
  ) {
    return `[${step}] 1Shot relayer — set CHAIN_MODE=mainnet, RELAYER_MODE=relayer, fund specialist mainnet ETH+USDC, and NEXT_PUBLIC_APP_URL to a public tunnel for /api/relayer-webhook`;
  }

  if (lower.includes("nonce")) {
    return `[${step}] Nonce conflict — wait for pending txs on contractor or specialist EOAs, then retry`;
  }

  if (
    lower.includes("signature") ||
    lower.includes("sign") ||
    lower.includes("unauthorized")
  ) {
    return `[${step}] Signature failed — reconnect MetaMask; contractor session key is stored in localStorage (do not clear between runs)`;
  }

  if (
    lower.includes("gas") ||
    lower.includes("funds for gas") ||
    lower.includes("insufficient funds")
  ) {
    return `[${step}] Insufficient ETH for gas — fund contractor EOA (${step}) and all 3 specialist EOAs on Base Sepolia`;
  }

  if (decoded?.errorName) {
    return `[${step}] Revert ${decoded.errorName}: ${decoded.message}`;
  }

  return `[${step}] ${raw}`;
}
