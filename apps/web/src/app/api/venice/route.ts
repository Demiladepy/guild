import { venice } from "@guild/core/config";
import { NextResponse } from "next/server";

const PROMPT =
  "Summarize what an autonomous agent labor market is in 2 sentences";

export async function POST() {
  try {
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
      return NextResponse.json(
        { error: `Venice API error (${response.status}): ${body}` },
        { status: response.status },
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        { error: "Venice returned no completion content" },
        { status: 502 },
      );
    }

    return NextResponse.json({ content, prompt: PROMPT });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
