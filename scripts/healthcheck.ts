import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { publicClient } from "@guild/core/config";

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

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function main() {
  loadEnvFile();

  const blockNumber = await publicClient.getBlockNumber();
  console.log(`Base Sepolia latest block: ${blockNumber}`);

  const veniceKey = requireEnv("VENICE_API_KEY");
  const bundlerUrl = requireEnv("BUNDLER_RPC_URL");

  console.log(`VENICE_API_KEY: set (${veniceKey.length} chars)`);
  console.log(`BUNDLER_RPC_URL: set (${bundlerUrl})`);
  console.log("Health check passed.");
}

main().catch((error) => {
  console.error("Health check failed:", error);
  process.exit(1);
});
