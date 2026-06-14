import { pushRelayerEvent } from "@/lib/relayer-event-bus";
import { verifyRelayerWebhook } from "@/lib/relayer-webhook-verify";
import type { RelayerStatusResponse } from "@guild/core/relayer";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const valid = await verifyRelayerWebhook(body);
    if (!valid) {
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
    }

    const envelope = body as {
      apiVersion: number;
      type: 0 | 1 | 4;
      data: RelayerStatusResponse;
      timestamp: number;
      keyId: string;
    };

    const event = pushRelayerEvent(envelope);
    return NextResponse.json({ ok: true, taskId: event.taskId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
