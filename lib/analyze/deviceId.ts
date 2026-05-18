import { getPref, setPref } from "../storage/browser/prefs";

const KEY = "analyze.deviceId";

export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await getPref<string>(KEY);
  if (existing) return existing;
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  await setPref<string>(KEY, id);
  return id;
}
