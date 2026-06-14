import { addresses } from "@guild/core/config";
import { x402ExactEvmErc7710ServerScheme } from "@metamask/x402";
import { x402HTTPResourceServer } from "@x402/core/http";
import {
  HTTPFacilitatorClient,
  x402ResourceServer,
  type HTTPAdapter,
  type HTTPProcessResult,
  type HTTPResponseInstructions,
} from "@x402/core/server";

let initPromise: Promise<x402HTTPResourceServer> | null = null;

function requirePayTo(): `0x${string}` {
  const value = process.env.X402_PAYTO_ADDRESS;
  if (!value) {
    throw new Error("Missing X402_PAYTO_ADDRESS in environment");
  }
  return value as `0x${string}`;
}

export async function getX402HttpServer() {
  if (!initPromise) {
    initPromise = (async () => {
      const facilitator = new HTTPFacilitatorClient({
        url: addresses.x402FacilitatorUrl,
      });

      const resourceServer = new x402ResourceServer(facilitator).register(
        "eip155:84532",
        new x402ExactEvmErc7710ServerScheme(),
      );

      const httpServer = new x402HTTPResourceServer(resourceServer, {
        "POST /api/x402/venice-inference": {
          accepts: [
            {
              scheme: "exact",
              price: "$0.01",
              network: "eip155:84532",
              payTo: requirePayTo(),
            },
          ],
          description:
            "Guild Venice inference proxy — ERC-7710 x402 on Base Sepolia",
          mimeType: "application/json",
          resource: "https://api.venice.ai/api/v1/chat/completions",
        },
      });

      await httpServer.initialize();
      return httpServer;
    })();
  }

  return initPromise;
}

export function createRequestAdapter(request: Request): HTTPAdapter {
  const url = new URL(request.url);

  return {
    getHeader: (name) => request.headers.get(name) ?? undefined,
    getMethod: () => request.method,
    getPath: () => url.pathname,
    getUrl: () => request.url,
    getAcceptHeader: () => request.headers.get("accept") ?? "",
    getUserAgent: () => request.headers.get("user-agent") ?? "",
  };
}

export function instructionsToResponse(
  instructions: HTTPResponseInstructions,
): Response {
  const body =
    instructions.body === undefined
      ? null
      : instructions.isHtml
        ? String(instructions.body)
        : JSON.stringify(instructions.body);

  return new Response(body, {
    status: instructions.status,
    headers: instructions.headers,
  });
}

export async function processX402Request(
  request: Request,
): Promise<HTTPProcessResult> {
  const httpServer = await getX402HttpServer();
  return httpServer.processHTTPRequest({
    adapter: createRequestAdapter(request),
    path: new URL(request.url).pathname,
    method: request.method,
  });
}

export async function settleX402Payment(
  request: Request,
  verified: Extract<HTTPProcessResult, { type: "payment-verified" }>,
) {
  const httpServer = await getX402HttpServer();
  const context = {
    adapter: createRequestAdapter(request),
    path: new URL(request.url).pathname,
    method: request.method,
  };

  return httpServer.processSettlement(
    verified.paymentPayload,
    verified.paymentRequirements,
    verified.declaredExtensions,
    { request: context },
  );
}
