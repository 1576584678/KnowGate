"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { trackLearningEvent } from "@/lib/tracking";

export function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return;

    trackLearningEvent({
      eventType: "page_viewed",
      entityType: "page",
      entityId: pathname,
      payload: { path: pathname },
    });
  }, [pathname]);

  return null;
}
