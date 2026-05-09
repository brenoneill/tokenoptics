"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "tokenoptics:min-conversation-cost";

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): number | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function getServerSnapshot(): number | null {
  return null;
}

export function useMinConversationCost(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function setMinConversationCost(value: number | null): void {
  if (value === null || !Number.isFinite(value) || value <= 0) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, String(value));
  }
  for (const l of listeners) l();
}
