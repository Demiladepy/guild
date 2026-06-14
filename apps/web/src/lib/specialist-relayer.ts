import { chainId, publicClient } from "@guild/core/config";
import {
  decodeDelegations,
} from "@metamask/smart-accounts-kit/utils";
import {
  Implementation,
  toMetaMaskSmartAccount,
} from "@metamask/smart-accounts-kit";
import {
  estimate7710,
  getCapabilities,
  getFeeData,
  send7710,
  toRelayerJson,
  type AuthorizationListEntry,
  type Delegation7710,
  type Send7710TransactionParams,
} from "@guild/core/relayer";
import type { Hex } from "viem";
import {
  encodeFunctionData,
  erc20Abi,
  getAddress,
  parseUnits,
} from "viem";
import type { PrivateKeyAccount } from "viem/accounts";
import { getSmartAccountsEnvironment } from "@metamask/smart-accounts-kit";

const WORK_AMOUNT = parseUnits("0.01", 6);
const EIP7702_PREFIX = "0xef0100";

export function getRelayerWebhookUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    (typeof window !== "undefined" ? window.location.origin : "");
  if (!base) {
    throw new Error(
      "Set NEXT_PUBLIC_APP_URL to a publicly reachable URL for 1Shot webhooks",
    );
  }
  return `${base.replace(/\/$/, "")}/api/relayer-webhook`;
}

export function getInferencePayTo(): `0x${string}` {
  const value = process.env.NEXT_PUBLIC_X402_PAYTO_ADDRESS;
  if (!value) {
    throw new Error("Set NEXT_PUBLIC_X402_PAYTO_ADDRESS for inference payment");
  }
  return value as `0x${string}`;
}

async function specialistNeeds7702Upgrade(
  specialistAddress: `0x${string}`,
): Promise<boolean> {
  const environment = getSmartAccountsEnvironment(chainId);
  const code = await publicClient.getCode({ address: specialistAddress });
  if (!code || code === "0x") return true;

  const expectedImpl = environment.implementations.EIP7702StatelessDeleGatorImpl
    .toLowerCase()
    .slice(2);
  return !code.toLowerCase().includes(expectedImpl);
}

async function buildAuthorizationList(
  specialistAccount: PrivateKeyAccount,
): Promise<AuthorizationListEntry[] | undefined> {
  const needsUpgrade = await specialistNeeds7702Upgrade(specialistAccount.address);
  if (!needsUpgrade) return undefined;

  const environment = getSmartAccountsEnvironment(chainId);
  const nonce = await publicClient.getTransactionCount({
    address: specialistAccount.address,
    blockTag: "pending",
  });

  const auth = await specialistAccount.signAuthorization({
    chainId,
    contractAddress: getAddress(
      environment.implementations.EIP7702StatelessDeleGatorImpl,
    ),
    nonce,
  });

  return [
    {
      address: auth.address,
      chainId: auth.chainId,
      nonce: auth.nonce,
      r: auth.r,
      s: auth.s,
      yParity: auth.yParity ?? 0,
    },
  ];
}

export async function submitSpecialistVeniceRelay(params: {
  specialistAccount: PrivateKeyAccount;
  redelegatedContext: Hex;
  memo?: string;
}): Promise<{
  taskId: `0x${string}`;
  smartAccountAddress: `0x${string}`;
  feeAmount: bigint;
  workAmount: bigint;
}> {
  const capabilities = await getCapabilities([String(chainId)]);
  const chainCaps = capabilities[String(chainId)];
  if (!chainCaps) {
    throw new Error(`1Shot relayer does not support chain ${chainId}`);
  }

  const usdc =
    chainCaps.tokens.find((t) => t.symbol === "USDC") ?? chainCaps.tokens[0];
  if (!usdc) {
    throw new Error("No stablecoin gas token returned by relayer_getCapabilities");
  }

  await toMetaMaskSmartAccount({
    client: publicClient,
    implementation: Implementation.Stateless7702,
    address: params.specialistAccount.address,
    signer: { account: params.specialistAccount },
  });

  const feeData = await getFeeData({
    chainId: String(chainId),
    token: usdc.address,
  });

  // getFeeData confirms token support + minFee floor; locked send context comes
  // from estimate7710 per 1Shot skill (not feeData.context) — see README.
  const mockFeeAmount = BigInt(feeData.minFee);
  const payTo = getInferencePayTo();
  const permissionContext = decodeDelegations(params.redelegatedContext).map(
    (delegation) => toRelayerJson(delegation) as Delegation7710,
  );

  const authorizationList = await buildAuthorizationList(params.specialistAccount);

  function buildSendParams(feeAmount: bigint): Send7710TransactionParams {
    const feeCalldata = encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [chainCaps.feeCollector, feeAmount],
    });
    const workCalldata = encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [payTo, WORK_AMOUNT],
    });

    return {
      chainId: String(chainId),
      ...(authorizationList ? { authorizationList } : {}),
      transactions: [
        {
          permissionContext,
          executions: [
            { target: usdc.address, value: "0", data: feeCalldata },
            { target: usdc.address, value: "0", data: workCalldata },
          ],
        },
      ],
    };
  }

  let sendParams = buildSendParams(mockFeeAmount);
  let estimate = await estimate7710(sendParams);
  if (!estimate.success) {
    throw new Error(estimate.error ?? "relayer_estimate7710Transaction failed");
  }

  const requiredFee = BigInt(estimate.requiredPaymentAmount ?? mockFeeAmount);
  if (requiredFee !== mockFeeAmount) {
    sendParams = buildSendParams(requiredFee);
    estimate = await estimate7710(sendParams);
    if (!estimate.success) {
      throw new Error(estimate.error ?? "relayer re-estimate failed");
    }
  }

  if (!estimate.context) {
    throw new Error("Estimate did not return a signed fee context");
  }

  const taskId = await send7710({
    ...sendParams,
    context: estimate.context,
    destinationUrl: getRelayerWebhookUrl(),
    memo: params.memo ?? "guild-specialist-venice",
  });

  return {
    taskId,
    smartAccountAddress: params.specialistAccount.address,
    feeAmount: requiredFee,
    workAmount: WORK_AMOUNT,
  };
}

export { EIP7702_PREFIX };
