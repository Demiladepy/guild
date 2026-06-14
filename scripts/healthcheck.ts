import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { addresses, chain, chainId, publicClient, venice } from "@guild/core/config";
import { formatEther, formatUnits, erc20Abi } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const BASE_SEPOLIA_CHAIN_ID = 84532;
const IDENTITY_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e" as const;
const REPUTATION_REGISTRY = "0x8004B663056A597Dffe9eCcC1965A193B7388713" as const;

const SPECIALIST_KEYS = {
  researcher: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78627d",
  analyst: "0x5de4111afa1a4b94908f83103eb1f96bd9bdbf459de6aa9350166566129f7c5a",
  writer: "0x47e179ec197488593b187fd192a05fc657a282424667ef8d97bc6da81a30ffa0",
} as const;

type CheckResult = {
  name: string;
  pass: boolean;
  detail: string;
};

function loadEnvFile() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;

  const contents = readFileSync(envPath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

/** Mirrors apps/web/src/lib/verify-registry.ts */
async function verifyRegistriesDeployed() {
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

function padEnd(str: string, len: number) {
  return str.length >= len ? str : str + " ".repeat(len - str.length);
}

function printTable(results: CheckResult[]) {
  const nameWidth = Math.max(28, ...results.map((r) => r.name.length));
  console.log("");
  console.log(
    `${padEnd("CHECK", nameWidth)}  STATUS  DETAIL`,
  );
  console.log("-".repeat(nameWidth + 60));

  for (const row of results) {
    const status = row.pass ? "PASS" : "FAIL";
    console.log(`${padEnd(row.name, nameWidth)}  ${status}    ${row.detail}`);
  }

  const failed = results.filter((r) => !r.pass).length;
  console.log("");
  console.log(
    failed === 0
      ? `All ${results.length} checks passed.`
      : `${failed} of ${results.length} checks failed.`,
  );
}

async function checkRpc(): Promise<CheckResult> {
  try {
    const [blockNumber, liveChainId] = await Promise.all([
      publicClient.getBlockNumber(),
      publicClient.getChainId(),
    ]);

    if (liveChainId !== BASE_SEPOLIA_CHAIN_ID) {
      return {
        name: "RPC + chainId 84532",
        pass: false,
        detail: `wrong chainId ${liveChainId} (expected ${BASE_SEPOLIA_CHAIN_ID}, active config: ${chain.name} ${chainId})`,
      };
    }

    return {
      name: "RPC + chainId 84532",
      pass: true,
      detail: `block ${blockNumber} on ${chain.name}`,
    };
  } catch (error) {
    return {
      name: "RPC + chainId 84532",
      pass: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

async function checkRegistries(): Promise<CheckResult> {
  try {
    const registry = await verifyRegistriesDeployed();
    const addressesMatch =
      registry.identityRegistry.toLowerCase() === IDENTITY_REGISTRY.toLowerCase() &&
      registry.reputationRegistry.toLowerCase() === REPUTATION_REGISTRY.toLowerCase();

    if (!registry.identityDeployed || !registry.reputationDeployed) {
      const missing = [
        !registry.identityDeployed ? "IdentityRegistry" : null,
        !registry.reputationDeployed ? "ReputationRegistry" : null,
      ]
        .filter(Boolean)
        .join(", ");
      return {
        name: "ERC-8004 registries",
        pass: false,
        detail: `no bytecode: ${missing}`,
      };
    }

    if (!addressesMatch) {
      return {
        name: "ERC-8004 registries",
        pass: false,
        detail: `bytecode ok but addresses differ from singletons`,
      };
    }

    return {
      name: "ERC-8004 registries",
      pass: true,
      detail: `identity ${registry.identityRegistry.slice(0, 10)}… + reputation ${registry.reputationRegistry.slice(0, 10)}…`,
    };
  } catch (error) {
    return {
      name: "ERC-8004 registries",
      pass: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

async function checkVenice(): Promise<CheckResult> {
  const apiKey = process.env.VENICE_API_KEY;
  const model = process.env.VENICE_MODEL;

  if (!apiKey) {
    return {
      name: "Venice inference",
      pass: false,
      detail: "VENICE_API_KEY unset",
    };
  }
  if (!model) {
    return {
      name: "Venice inference",
      pass: false,
      detail: "VENICE_MODEL unset",
    };
  }

  try {
    const response = await fetch(`${venice.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Reply with exactly: guild-health-ok" }],
        max_tokens: 16,
      }),
    });

    const bodyText = await response.text();
    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try {
        const parsed = JSON.parse(bodyText) as { error?: string };
        if (parsed.error) detail += ` — ${parsed.error}`;
      } catch {
        if (bodyText) detail += ` — ${bodyText.slice(0, 120)}`;
      }
      return { name: "Venice inference", pass: false, detail };
    }

    const data = JSON.parse(bodyText) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return {
        name: "Venice inference",
        pass: false,
        detail: "200 OK but no completion text in response",
      };
    }

    const preview =
      content.length > 72 ? `${content.slice(0, 72)}…` : content;
    return {
      name: "Venice inference",
      pass: true,
      detail: `model=${model} → "${preview}"`,
    };
  } catch (error) {
    return {
      name: "Venice inference",
      pass: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

async function checkX402Route(appUrl: string): Promise<CheckResult> {
  if (!process.env.X402_PAYTO_ADDRESS) {
    return {
      name: "x402 route (unpaid → 402)",
      pass: false,
      detail: "X402_PAYTO_ADDRESS unset (server returns 500 without it)",
    };
  }

  const endpoint = `${appUrl.replace(/\/$/, "")}/api/x402/venice-inference`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });

    const bodyText = await response.text();
    const paymentHeader =
      response.headers.get("payment-required") ??
      response.headers.get("PAYMENT-REQUIRED");

    if (response.status === 500) {
      let detail = "HTTP 500";
      try {
        const parsed = JSON.parse(bodyText) as { error?: string };
        if (parsed.error) detail += ` — ${parsed.error}`;
      } catch {
        if (bodyText) detail += ` — ${bodyText.slice(0, 120)}`;
      }
      if (detail.includes("X402_PAYTO_ADDRESS")) {
        detail += " (restart dev server after updating .env)";
      }
      return { name: "x402 route (unpaid → 402)", pass: false, detail };
    }

    if (response.status !== 402) {
      return {
        name: "x402 route (unpaid → 402)",
        pass: false,
        detail: `expected 402, got ${response.status}`,
      };
    }

    let hasRequirements = Boolean(paymentHeader);
    if (!hasRequirements && bodyText) {
      try {
        const parsed = JSON.parse(bodyText) as Record<string, unknown>;
        hasRequirements =
          "accepts" in parsed ||
          "paymentRequirements" in parsed ||
          "x402Version" in parsed ||
          JSON.stringify(parsed).toLowerCase().includes("payment");
      } catch {
        hasRequirements = bodyText.toLowerCase().includes("payment");
      }
    }

    if (!hasRequirements) {
      return {
        name: "x402 route (unpaid → 402)",
        pass: false,
        detail: "402 but no payment requirements in body/headers",
      };
    }

    return {
      name: "x402 route (unpaid → 402)",
      pass: true,
      detail: `402 from ${endpoint}`,
    };
  } catch (error) {
    return {
      name: "x402 route (unpaid → 402)",
      pass: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

async function readBalances(address: `0x${string}`) {
  const [ethWei, usdcRaw] = await Promise.all([
    publicClient.getBalance({ address }),
    publicClient.readContract({
      address: addresses.usdc,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [address],
    }),
  ]);
  return {
    eth: formatEther(ethWei),
    usdc: formatUnits(usdcRaw, 6),
    ethWei,
    usdcRaw,
  };
}

async function checkWalletFunding(): Promise<CheckResult> {
  const contractorAddress = process.env.GUILD_CONTRACTOR_ADDRESS as
    | `0x${string}`
    | undefined;

  type WalletRow = { label: string; address: `0x${string}` };
  const wallets: WalletRow[] = [];

  for (const [role, key] of Object.entries(SPECIALIST_KEYS)) {
    wallets.push({
      label: role,
      address: privateKeyToAccount(key as `0x${string}`).address,
    });
  }

  if (contractorAddress) {
    wallets.unshift({ label: "contractor", address: contractorAddress });
  }

  const parts: string[] = [];
  const broke: string[] = [];

  if (!contractorAddress) {
    broke.push(
      "contractor unset — export GUILD_CONTRACTOR_ADDRESS from UI after Connect",
    );
  }

  for (const w of wallets) {
    const bal = await readBalances(w.address);
    parts.push(`${w.label} ${bal.eth} ETH / ${bal.usdc} USDC`);
    if (bal.ethWei === 0n || bal.usdcRaw === 0n) {
      broke.push(`${w.label} ${w.address.slice(0, 10)}…`);
    }
  }

  if (broke.length > 0) {
    return {
      name: "Wallet funding (ETH+USDC)",
      pass: false,
      detail: `${broke.join(", ")} need funding`,
    };
  }

  return {
    name: "Wallet funding (ETH+USDC)",
    pass: true,
    detail: parts.join(" · "),
  };
}

async function checkAppUrl(): Promise<CheckResult & { url?: string }> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (!appUrl) {
    return {
      name: "NEXT_PUBLIC_APP_URL",
      pass: false,
      detail: "unset",
    };
  }

  try {
    const response = await fetch(appUrl.replace(/\/$/, ""), {
      method: "GET",
      redirect: "follow",
    });

    if (!response.ok) {
      return {
        name: "NEXT_PUBLIC_APP_URL",
        pass: false,
        detail: `GET ${appUrl} → HTTP ${response.status}`,
        url: appUrl,
      };
    }

    return {
      name: "NEXT_PUBLIC_APP_URL",
      pass: true,
      detail: `GET ${appUrl} → HTTP ${response.status}`,
      url: appUrl,
    };
  } catch (error) {
    return {
      name: "NEXT_PUBLIC_APP_URL",
      pass: false,
      detail: error instanceof Error ? error.message : String(error),
      url: appUrl,
    };
  }
}

async function main() {
  loadEnvFile();

  console.log("Guild pre-flight healthcheck");
  console.log(`chain config: ${chain.name} (${chainId})`);

  const results: CheckResult[] = [];

  results.push(await checkRpc());
  results.push(await checkRegistries());
  results.push(await checkVenice());

  const appUrlResult = await checkAppUrl();
  results.push(appUrlResult);

  if (appUrlResult.pass && appUrlResult.url) {
    results.push(await checkX402Route(appUrlResult.url));
  } else {
    results.push({
      name: "x402 route (unpaid → 402)",
      pass: false,
      detail: "skipped — NEXT_PUBLIC_APP_URL not reachable (start: pnpm --filter web dev)",
    });
  }

  results.push(await checkWalletFunding());

  printTable(results);

  if (results.some((r) => !r.pass)) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Healthcheck crashed:", error);
  process.exit(1);
});
