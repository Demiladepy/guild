import { buildAgentRegistrationFile } from "@/lib/agent-registration-files";
import type { SpecialistRole } from "@/lib/agents";
import { NextResponse } from "next/server";

const VALID_ROLES = new Set<SpecialistRole>(["researcher", "analyst", "writer"]);

export async function GET(
  _request: Request,
  { params }: { params: { role: string } },
) {
  if (!VALID_ROLES.has(params.role as SpecialistRole)) {
    return NextResponse.json({ error: "Unknown agent role" }, { status: 404 });
  }

  const file = buildAgentRegistrationFile(params.role as SpecialistRole);
  return NextResponse.json(file, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
