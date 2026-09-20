export type LearningSettings = {
  learningMode: boolean;
  extendedTime: boolean;
  reducedMotion: boolean;
  sound: boolean;
};

export const defaultSettings: LearningSettings = {
  learningMode: false,
  extendedTime: false,
  reducedMotion: false,
  sound: true,
};

const SETTINGS_STORAGE_KEY = "knowgate.settings.v1";

export function readSettings(): LearningSettings {
  if (typeof window === "undefined") return defaultSettings;

  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    return raw
      ? { ...defaultSettings, ...(JSON.parse(raw) as Partial<LearningSettings>) }
      : defaultSettings;
  } catch {
    return defaultSettings;
  }
}

export function writeSettings(settings: LearningSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}
