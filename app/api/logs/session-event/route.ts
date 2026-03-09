import { NextRequest, NextResponse } from "next/server";
import { postToStrapiCollection } from "@/lib/strapiLogging";
import { TrainingAnswerEventPayload } from "@/types";

function isValidAnswerEvent(payload: unknown): payload is TrainingAnswerEventPayload {
  if (!payload || typeof payload !== "object") return false;
  const candidate = payload as Partial<TrainingAnswerEventPayload>;

  return (
    typeof candidate.sessionId === "string" &&
    typeof candidate.timestamp === "string" &&
    candidate.mode === "exam" &&
    typeof candidate.selectedFile === "string" &&
    typeof candidate.wordId === "number" &&
    typeof candidate.isCorrect === "boolean" &&
    typeof candidate.attemptNumber === "number" &&
    (typeof candidate.durationMs === "number" || candidate.durationMs === null) &&
    typeof candidate.reverseDirection === "boolean"
  );
}

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isValidAnswerEvent(body)) {
    return NextResponse.json({ error: "Invalid session event payload" }, { status: 400 });
  }

  try {
    const strapiResponse = await postToStrapiCollection("training-answer-events", body);

    if (!strapiResponse.ok) {
      const errorText = await strapiResponse.text();
      console.error("Strapi session-event forwarding failed:", strapiResponse.status, errorText);
      return NextResponse.json(
        { error: "Failed to persist session event in Strapi" },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("Session-event proxy failed:", error);
    return NextResponse.json(
      { error: "Session event proxy is not configured or unavailable" },
      { status: 500 },
    );
  }
}
