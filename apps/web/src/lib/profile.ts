export const DEFAULT_PROFILE_ID = "local-demo";
export const PROFILE_HEADER = "x-knowgate-profile-id";

const PROFILE_STORAGE_KEY = "knowgate.profile.v1";
const PROFILE_ID_PATTERN = /^[a-zA-Z0-9._:-]{1,128}$/;

export function isValidProfileId(value: string | null | undefined) {
  const candidate = value?.trim();
  return Boolean(candidate && PROFILE_ID_PATTERN.test(candidate));
}

export function normalizeProfileId(value: string | null | undefined) {
  const candidate = value?.trim();
  return isValidProfileId(candidate) ? candidate! : DEFAULT_PROFILE_ID;
}

export function getProfileIdFromRequest(request: Request) {
  return normalizeProfileId(request.headers.get(PROFILE_HEADER));
}

export function getClientProfileId() {
  if (typeof window === "undefined") return DEFAULT_PROFILE_ID;

  const existing = normalizeProfileId(
    window.localStorage.getItem(PROFILE_STORAGE_KEY),
  );
  if (existing !== DEFAULT_PROFILE_ID) return existing;

  const profileId = crypto.randomUUID();
  window.localStorage.setItem(PROFILE_STORAGE_KEY, profileId);
  return profileId;
}

export function profileHeaders(headers?: HeadersInit) {
  return {
    ...headers,
    [PROFILE_HEADER]: getClientProfileId(),
  };
}
