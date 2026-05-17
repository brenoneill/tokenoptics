// IndexedDB helpers for routing runs. Kept separate from the shared
// ConversationStore interface because routing analysis is a browser-only,
// experimental feature.

import { HARNESSES } from "../harnesses";
import { getDexie, sessionKey } from "../storage/browser/db";
import type { RoutingRunRecord } from "./types";

async function resolveSessionKey(
  projectId: string,
  sessionId: string,
): Promise<string | null> {
  const db = getDexie();
  for (const h of HARNESSES) {
    const row = await db.conversations.get(sessionKey(h.id, projectId, sessionId));
    if (row) return row.key;
  }
  return null;
}

export async function getRoutingRun(
  projectId: string,
  sessionId: string,
): Promise<RoutingRunRecord | null> {
  const key = await resolveSessionKey(projectId, sessionId);
  if (!key) return null;
  const row = await getDexie().routingRuns.get(key);
  if (!row) return null;
  const record = row.data as RoutingRunRecord;
  // Pre-features/pre-calibration runs lack required fields. Treat them as
  // missing so the UI prompts a fresh run instead of crashing on undefined.
  const stale =
    record.turns.length > 0 &&
    (record.turns[0].counterfactualUsage === undefined ||
      record.turns[0].features === undefined);
  if (stale) return null;
  return record;
}

export async function saveRoutingRun(record: RoutingRunRecord): Promise<void> {
  const key = await resolveSessionKey(record.projectId, record.sessionId);
  if (!key) throw new Error("Conversation not indexed locally");
  await getDexie().routingRuns.put({
    sessionKey: key,
    runId: record.runId,
    completedAt: record.completedAt,
    data: record,
  });
}

export async function deleteRoutingRun(
  projectId: string,
  sessionId: string,
): Promise<void> {
  const key = await resolveSessionKey(projectId, sessionId);
  if (!key) return;
  await getDexie().routingRuns.delete(key);
}
