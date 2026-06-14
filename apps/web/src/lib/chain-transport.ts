import { chain } from "@guild/core/config";
import { http, type HttpTransport } from "viem";

/** Shared Base Sepolia HTTP transport for browser wallet clients. */
export function getGuildHttpTransport(): HttpTransport {
  const url =
    process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL ??
    chain.rpcUrls.default.http[0];
  return http(url);
}
