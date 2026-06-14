import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const CONTRACTOR_KEY_STORAGE = "guild-contractor-session-key";

function loadOrCreateAccount(storageKey: string) {
  if (typeof window === "undefined") {
    throw new Error("Session accounts can only be created in the browser");
  }

  const existing =
    localStorage.getItem(storageKey) ??
    (() => {
      const legacy = sessionStorage.getItem(storageKey);
      if (legacy) {
        localStorage.setItem(storageKey, legacy);
        sessionStorage.removeItem(storageKey);
      }
      return legacy;
    })();
  const privateKey = (existing ?? generatePrivateKey()) as `0x${string}`;

  if (!existing) {
    localStorage.setItem(storageKey, privateKey);
  }

  return privateKeyToAccount(privateKey);
}

export function getOrCreateContractorAccount() {
  return loadOrCreateAccount(CONTRACTOR_KEY_STORAGE);
}
