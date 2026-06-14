import { createx402DelegationProvider } from "@metamask/smart-accounts-kit/experimental";
import { x402Erc7710Client } from "@metamask/x402";
import { x402Client, x402HTTPClient } from "@x402/core/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import type { Account, Hex } from "viem";
import { formatJobError } from "@/lib/job-errors";

export function buildSpecialistX402Client(params: {
  specialistAccount: Account;
  redelegatedContext: Hex;
  contractorAddress: `0x${string}`;
}) {
  const delegationProvider = createx402DelegationProvider({
    account: params.specialistAccount,
    parentPermissionContext: params.redelegatedContext,
    from: params.contractorAddress,
  });

  const erc7710Client = new x402Erc7710Client({ delegationProvider });
  const coreClient = new x402Client().register("eip155:*", erc7710Client);
  const httpClient = new x402HTTPClient(coreClient);
  const fetchWithPayment = wrapFetchWithPayment(fetch, httpClient);

  return { delegationProvider, httpClient, fetchWithPayment };
}

/** Venice /chat/completions via x402 ERC-7710 delegated USDC payment. */
export async function runVeniceViaX402(params: {
  specialistAccount: Account;
  redelegatedContext: Hex;
  contractorAddress: `0x${string}`;
}): Promise<{ content: string; settlementTx: `0x${string}` | null }> {
  const { fetchWithPayment } = buildSpecialistX402Client(params);

  let response: Response;
  try {
    response = await fetchWithPayment("/api/x402/venice-inference", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    throw new Error(formatJobError(err, "x402-fetch"));
  }

  const bodyText = await response.text();
  let data: {
    content?: string;
    settlementTx?: string;
    error?: string;
  } = {};

  try {
    data = bodyText ? (JSON.parse(bodyText) as typeof data) : {};
  } catch {
    data = { error: bodyText.slice(0, 200) };
  }

  if (!response.ok || !data.content) {
    const statusHint =
      response.status === 402
        ? "402 payment required — delegation may lack USDC or pay→retry failed"
        : `HTTP ${response.status}`;
    throw new Error(
      formatJobError(
        new Error(data.error ?? `Venice x402 failed (${statusHint})`),
        "x402-inference",
      ),
    );
  }

  return {
    content: data.content,
    settlementTx: data.settlementTx
      ? (data.settlementTx as `0x${string}`)
      : null,
  };
}

export const BLOCKED_ATTESTATION =
  "Blocked by delegation framework — Specialist cannot exceed delegated authority.";
