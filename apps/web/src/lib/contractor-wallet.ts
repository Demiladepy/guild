import { chain } from "@guild/core/config";
import { createWalletClient } from "viem";
import { erc7710WalletActions } from "@metamask/smart-accounts-kit/actions";
import { getGuildHttpTransport } from "@/lib/chain-transport";
import { getOrCreateContractorAccount } from "@/lib/session-account";

/** Contractor session EOA wallet client with stable signing + Sepolia RPC. */
export function createContractorWalletClient() {
  const account = getOrCreateContractorAccount();
  return createWalletClient({
    account,
    chain,
    transport: getGuildHttpTransport(),
  }).extend(erc7710WalletActions());
}
