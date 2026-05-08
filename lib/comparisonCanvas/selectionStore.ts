"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "tokenoptics:comparison-canvas-selection";

export function selectionKey(projectId: string, sessionId: string): string {
  return `${projectId}|${sessionId}`;
}

const listeners = new Set<() => void>();

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

let snapshot: readonly string[] = [];
let initialized = false;

function ensureInit() {
  if (initialized) return;
  initialized = true;
  snapshot = read();
}

function refresh() {
  snapshot = read();
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  ensureInit();
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) refresh();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): readonly string[] {
  ensureInit();
  return snapshot;
}

const EMPTY: readonly string[] = [];
function getServerSnapshot(): readonly string[] {
  return EMPTY;
}

function write(next: readonly string[]) {
  if (typeof window === "undefined") return;
  if (next.length === 0) localStorage.removeItem(STORAGE_KEY);
  else localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  refresh();
}

export function useComparisonSelection(): readonly string[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function addToComparison(key: string): void {
  ensureInit();
  if (snapshot.includes(key)) return;
  write([...snapshot, key]);
}

export function removeFromComparison(key: string): void {
  ensureInit();
  if (!snapshot.includes(key)) return;
  write(snapshot.filter((k) => k !== key));
}

export function clearComparison(): void {
  write([]);
}

export function isInComparison(
  selection: readonly string[],
  projectId: string,
  sessionId: string,
): boolean {
  return selection.includes(selectionKey(projectId, sessionId));
}
