let clientSessionPromise: Promise<void> | null = null;

async function initializeProfileSession() {
  const response = await fetch("/api/v1/profile/session", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("PROFILE_SESSION_FAILED");
  }
}

export async function ensureProfileSession() {
  if (typeof window === "undefined") return;
  clientSessionPromise ??= initializeProfileSession().catch((error) => {
    clientSessionPromise = null;
    throw error;
  });
  await clientSessionPromise;
}

export async function profileFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  await ensureProfileSession();
  return fetch(input, {
    ...init,
    credentials: "same-origin",
    cache: init?.cache ?? "no-store",
  });
}
