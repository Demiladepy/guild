import { getFeedback } from "@/lib/feedback-store";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const payload = getFeedback(params.id);
  if (!payload) {
    return NextResponse.json({ error: "Feedback not found" }, { status: 404 });
  }
  return NextResponse.json(payload);
}
