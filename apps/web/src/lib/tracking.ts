import type { LearningEventType } from "@knowgate/domain";
import { profileHeaders } from "@/lib/profile";

export function trackLearningEvent(input: {
  eventType: LearningEventType;
  entityType: string;
  entityId: string;
  payload?: Record<string, unknown>;
}) {
  if (typeof window === "undefined") return;

  void fetch("/api/v1/events", {
    method: "POST",
    headers: profileHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  }).catch(() => {
    // Analytics must not block the learning flow.
  });
}
