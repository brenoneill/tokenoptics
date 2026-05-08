import { getDexie } from "./db";

export async function getPref<T>(key: string): Promise<T | null> {
  const row = await getDexie().prefs.get(key);
  return row ? (row.value as T) : null;
}

export async function setPref<T>(key: string, value: T): Promise<void> {
  await getDexie().prefs.put({
    key,
    value,
    updatedAt: new Date().toISOString(),
  });
}

export interface EarlyAccessSignupPref {
  email: string;
  signedUpAt: string;
}

export const EARLY_ACCESS_BYOK_KEY = "earlyAccess.byokAiLabeling";
