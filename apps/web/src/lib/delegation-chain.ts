import { addresses, chain } from "@guild/core/config";
import type { GetGrantedExecutionPermissionsResult } from "@metamask/smart-accounts-kit/actions";
import {
  type RedelegatePermissionContextReturnType,
} from "@metamask/smart-accounts-kit/actions";
import {
  ScopeType,
  getSmartAccountsEnvironment,
} from "@metamask/smart-accounts-kit";
import { createCaveatBuilder } from "@metamask/smart-accounts-kit/utils";
import type { Account } from "viem";
import { parseUnits } from "viem";
import { createContractorWalletClient } from "@/lib/contractor-wallet";

type GrantedPermission = GetGrantedExecutionPermissionsResult[number];

export const SPECIALIST_TRANSFER_CAP = parseUnits("2", 6);

/** Venice x402 HTTP endpoints the Specialist may pay (endpoint-scoped attenuation). */
export const VENICE_X402_PATHS = [
  addresses.veniceX402TopUp,
  addresses.veniceChatCompletions,
  "/api/x402/venice-inference",
] as const;

export function buildVeniceOnlyCaveats() {
  const environment = getSmartAccountsEnvironment(chain.id);
  return createCaveatBuilder(environment)
    .addCaveat("allowedTargets", { targets: [addresses.usdc] })
    .addCaveat("allowedMethods", {
      selectors: ["transfer(address,uint256)"],
    })
    .build();
}

export async function redelegateToSpecialist(params: {
  contractorAccount: Account;
  specialistAddress: `0x${string}`;
  parentPermission: GrantedPermission;
}): Promise<RedelegatePermissionContextReturnType> {
  const environment = getSmartAccountsEnvironment(chain.id);
  const contractorClient = createContractorWalletClient();

  return contractorClient.redelegatePermissionContext({
    account: params.contractorAccount,
    chainId: chain.id,
    environment,
    permissionContext: params.parentPermission.context,
    to: params.specialistAddress,
    scope: {
      type: ScopeType.Erc20TransferAmount,
      tokenAddress: addresses.usdc,
      maxAmount: SPECIALIST_TRANSFER_CAP,
    },
    caveats: buildVeniceOnlyCaveats(),
  });
}
