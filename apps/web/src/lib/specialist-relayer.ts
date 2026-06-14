import { decodeDelegations } from "@metamask/smart-accounts-kit/utils";
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
import type { Chain, Hex, PublicClient } from "viem";
import { createPublicClient, encodeFunctionData, erc20Abi, getAddress, http, parseUnits } from "viem";
import type { PrivateKeyAccount } from "viem/accounts";
import { getSmartAccountsEnvironment } from "@metamask/smart-accounts-kit";

const WORK_AMOUNT = parseUnits("0.01", 6);
const EIP7702_PREFIX = "0xef0100";

export type RelayerSubmitTarget = {
  relayerUrl: string;
  chainId: number;
  chain: Chain;
  usdc: `0x${string}`;
  explorerTxUrl: string;
  rpcUrl: string;
};

function createTargetPublicClient(target: RelayerSubmitTarget): PublicClient {
  return createPublicClient({
    chain: target.chain,
    transport: http(target.rpcUrl),
  });
}

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
  target: RelayerSubmitTarget,
  client: PublicClient,
): Promise<boolean> {
  const environment = getSmartAccountsEnvironment(target.chainId);
  const code = await client.getCode({ address: specialistAddress });
  if (!code || code === "0x") return true;

  const expectedImpl = environment.implementations.EIP7702StatelessDeleGatorImpl
    .toLowerCase()
    .slice(2);
  return !code.toLowerCase().includes(expectedImpl);
}

async function buildAuthorizationList(
  specialistAccount: PrivateKeyAccount,
  target: RelayerSubmitTarget,
  client: PublicClient,
): Promise<AuthorizationListEntry[] | undefined> {
  const needsUpgrade = await specialistNeeds7702Upgrade(
    specialistAccount.address,
    target,
    client,
  );
  if (!needsUpgrade) return undefined;

  const environment = getSmartAccountsEnvironment(target.chainId);
  const nonce = await client.getTransactionCount({
    address: specialistAccount.address,
    blockTag: "pending",
  });

  const auth = await specialistAccount.signAuthorization({
    chainId: target.chainId,
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

export async function submitSpecialistVeniceRelay(
  params: {
    specialistAccount: PrivateKeyAccount;
    redelegatedContext: Hex;
    memo?: string;
  },
  target: RelayerSubmitTarget,
): Promise<{
  taskId: `0x${string}`;
  smartAccountAddress: `0x${string}`;
  feeAmount: bigint;
  workAmount: bigint;
}> {
  const client = createTargetPublicClient(target);
  const { relayerUrl } = target;

  const capabilities = await getCapabilities([String(target.chainId)], relayerUrl);
  const chainCaps = capabilities[String(target.chainId)];
  if (!chainCaps) {
    throw new Error(
      `1Shot relayer does not support chain ${target.chainId} at ${relayerUrl}`,
    );
  }

  const usdc =
    chainCaps.tokens.find((t) => t.symbol === "USDC") ?? chainCaps.tokens[0];
  if (!usdc) {
    throw new Error("No stablecoin gas token returned by relayer_getCapabilities");
  }

  await toMetaMaskSmartAccount({
    client,
    implementation: Implementation.Stateless7702,
    address: params.specialistAccount.address,
    signer: { account: params.specialistAccount },
  });

  const feeData = await getFeeData(
    { chainId: String(target.chainId), token: usdc.address },
    relayerUrl,
  );

  const mockFeeAmount = BigInt(feeData.minFee);
  const payTo = getInferencePayTo();
  const permissionContext = decodeDelegations(params.redelegatedContext).map(
    (delegation) => toRelayerJson(delegation) as Delegation7710,
  );

  const authorizationList = await buildAuthorizationList(
    params.specialistAccount,
    target,
    client,
  );

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
      chainId: String(target.chainId),
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
  let estimate = await estimate7710(sendParams, relayerUrl);
  if (!estimate.success) {
    throw new Error(estimate.error ?? "relayer_estimate7710Transaction failed");
  }

  const requiredFee = BigInt(estimate.requiredPaymentAmount ?? mockFeeAmount);
  if (requiredFee !== mockFeeAmount) {
    sendParams = buildSendParams(requiredFee);
    estimate = await estimate7710(sendParams, relayerUrl);
    if (!estimate.success) {
      throw new Error(estimate.error ?? "relayer re-estimate failed");
    }
  }

  if (!estimate.context) {
    throw new Error("Estimate did not return a signed fee context");
  }

  const taskId = await send7710(
    {
      ...sendParams,
      context: estimate.context,
      destinationUrl: getRelayerWebhookUrl(),
      memo: params.memo ?? "guild-specialist-venice",
    },
    relayerUrl,
  );

  return {
    taskId,
    smartAccountAddress: params.specialistAccount.address,
    feeAmount: requiredFee,
    workAmount: WORK_AMOUNT,
  };
}

export { EIP7702_PREFIX };
