import { venice } from "@guild/core/config";
import {
  instructionsToResponse,
  processX402Request,
  settleX402Payment,
} from "@/lib/x402-server";
import { NextResponse } from "next/server";

const PROMPT =
  "Summarize what an autonomous agent labor market is in 2 sentences";

async function callVenice() {
  const response = await fetch(`${venice.baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${venice.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: venice.model,
      messages: [{ role: "user", content: PROMPT }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Venice API error (${response.status}): ${body}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Venice returned no completion content");
  }

  return { content, prompt: PROMPT };
}

export async function POST(request: Request) {
  try {
    const paymentResult = await processX402Request(request);

    if (paymentResult.type === "payment-error") {
      return instructionsToResponse(paymentResult.response);
    }

    if (paymentResult.type === "no-payment-required") {
      return NextResponse.json({ error: "Route not protected" }, { status: 404 });
    }

    const inference = await callVenice();
    const settlement = await settleX402Payment(request, paymentResult);

    if (!settlement.success) {
      return instructionsToResponse(settlement.response);
    }

    return NextResponse.json(
      {
        content: inference.content,
        prompt: inference.prompt,
        settlementTx: settlement.transaction,
        network: settlement.network,
      },
      { headers: settlement.headers },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
