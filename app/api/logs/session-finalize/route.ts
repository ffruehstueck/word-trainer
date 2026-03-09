import { NextRequest, NextResponse } from "next/server";
import { postToStrapiCollection } from "@/lib/strapiLogging";
import { TrainingSessionFinalizePayload } from "@/types";

function isValidSessionFinalizePayload(payload: unknown): payload is TrainingSessionFinalizePayload {
  if (!payload || typeof payload !== "object") return false;
  const candidate = payload as Partial<TrainingSessionFinalizePayload>;

  if (
    typeof candidate.sessionId !== "string" ||
    typeof candidate.startedAt !== "string" ||
    typeof candidate.endedAt !== "string" ||
    (candidate.mode !== "exam" && candidate.mode !== "training") ||
    typeof candidate.selectedFile !== "string" ||
    typeof candidate.knownCount !== "number" ||
    typeof candidate.unknownCount !== "number" ||
    typeof candidate.totalAnswers !== "number"
  ) {
    return false;
  }

  if (candidate.mode === "exam") {
    if (!Array.isArray(candidate.unknownByWord)) return false;
    return candidate.unknownByWord.every((item) => {
      if (!item || typeof item !== "object") return false;
      const typedItem = item as TrainingSessionFinalizePayload["unknownByWord"][number];
      return (
        typeof typedItem.wordId === "number" &&
        typeof typedItem.incorrectCount === "number" &&
        typeof typedItem.correctCount === "number"
      );
    });
  }

  if (
    typeof candidate.viewedWords !== "number" ||
    typeof candidate.totalWords !== "number" ||
    typeof candidate.progressPercent !== "number"
  ) {
    return false;
  }

  return true;
}

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isValidSessionFinalizePayload(body)) {
    return NextResponse.json({ error: "Invalid session finalize payload" }, { status: 400 });
  }

  try {
    const sessionResponse = await postToStrapiCollection("training-sessions", {
      sessionId: body.sessionId,
      startedAt: body.startedAt,
      endedAt: body.endedAt,
      mode: body.mode,
      selectedFile: body.selectedFile,
      knownCount: body.knownCount,
      unknownCount: body.unknownCount,
      totalAnswers: body.totalAnswers,
      viewedWords: body.viewedWords,
      totalWords: body.totalWords,
      progressPercent: body.progressPercent,
      systemFingerprintHash: body.systemFingerprintHash,
      anonymousClientId: body.anonymousClientId,
    });

    if (!sessionResponse.ok) {
      const errorText = await sessionResponse.text();
      console.error("Strapi session-finalize forwarding failed:", sessionResponse.status, errorText);
      return NextResponse.json(
        { error: "Failed to persist session summary in Strapi" },
        { status: 502 },
      );
    }

    if (body.mode === "exam") {
      for (const aggregate of body.unknownByWord) {
        const aggregateResponse = await postToStrapiCollection("training-session-word-aggregates", {
          sessionId: body.sessionId,
          wordId: aggregate.wordId,
          incorrectCount: aggregate.incorrectCount,
          correctCount: aggregate.correctCount,
        });

        if (!aggregateResponse.ok) {
          const errorText = await aggregateResponse.text();
          console.error(
            "Strapi session-word-aggregate forwarding failed:",
            aggregateResponse.status,
            errorText,
          );
          return NextResponse.json(
            { error: "Failed to persist session word aggregates in Strapi" },
            { status: 502 },
          );
        }
      }
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("Session-finalize proxy failed:", error);
    return NextResponse.json(
      { error: "Session finalize proxy is not configured or unavailable" },
      { status: 500 },
    );
  }
}
