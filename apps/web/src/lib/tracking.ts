import type { LearningEventType } from "@knowgate/domain";
import { profileFetch } from "@/lib/profile-client";

export function trackLearningEvent(input: {
  eventType: LearningEventType;
  entityType: string;
  entityId: string;
  payload?: Record<string, unknown>;
}) {
  if (typeof window === "undefined") return;

  void profileFetch("/api/v1/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).catch(() => {
    // Analytics must not block the learning flow.
  });
}
