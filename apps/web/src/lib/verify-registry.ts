import { addresses, publicClient } from "@guild/core/config";

export type RegistryStatus = {
  identityDeployed: boolean;
  reputationDeployed: boolean;
  identityRegistry: `0x${string}`;
  reputationRegistry: `0x${string}`;
};

/** Confirms ERC-8004 singleton registries have bytecode on the active chain. */
export async function verifyRegistriesDeployed(): Promise<RegistryStatus> {
  const [identityCode, reputationCode] = await Promise.all([
    publicClient.getCode({ address: addresses.identityRegistry }),
    publicClient.getCode({ address: addresses.reputationRegistry }),
  ]);

  return {
    identityDeployed: Boolean(identityCode && identityCode !== "0x"),
    reputationDeployed: Boolean(reputationCode && reputationCode !== "0x"),
    identityRegistry: addresses.identityRegistry,
    reputationRegistry: addresses.reputationRegistry,
  };
}
