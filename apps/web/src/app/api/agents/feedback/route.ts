import { putFeedback } from "@/lib/feedback-store";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = (await request.json()) as { id?: string; payload?: Record<string, unknown> };
  if (!body.id || !body.payload) {
    return NextResponse.json({ error: "id and payload required" }, { status: 400 });
  }
  putFeedback(body.id, body.payload);
  return NextResponse.json({ ok: true });
}
