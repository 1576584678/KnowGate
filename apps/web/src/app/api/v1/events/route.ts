import { NextResponse } from "next/server";
import {
  learningEventTypes,
  type LearningEventType,
} from "@knowgate/domain";
import { recordLearningEvent } from "@/lib/chapter-store";
import { getProfileIdFromRequest } from "@/lib/profile";

export const runtime = "nodejs";

const trackableEvents = new Set<LearningEventType>([
  "chapter_started",
  "practice_answered",
  "remediation_started",
  "remediation_completed",
]);

function isTrackableEvent(value: string): value is LearningEventType {
  return learningEventTypes.includes(value as LearningEventType) &&
    trackableEvents.has(value as LearningEventType);
}

export async function POST(request: Request) {
  const profileId = getProfileIdFromRequest(request);
  const body = (await request.json()) as {
    eventType?: unknown;
    entityType?: unknown;
    entityId?: unknown;
    payload?: unknown;
  };

  if (
    typeof body.eventType !== "string" ||
    !isTrackableEvent(body.eventType) ||
    typeof body.entityType !== "string" ||
    typeof body.entityId !== "string"
  ) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_EVENT",
          message: "事件格式不正确。",
        },
      },
      { status: 400 },
    );
  }

  recordLearningEvent({
    profileId,
    eventType: body.eventType,
    entityType: body.entityType,
    entityId: body.entityId,
    payload:
      body.payload && typeof body.payload === "object"
        ? (body.payload as Record<string, unknown>)
        : {},
  });

  return NextResponse.json({ accepted: true }, { status: 202 });
}
