"use client";

import { useSyncExternalStore } from "react";

import { DEFAULT_KIRO_PLAN_ID, KIRO_PLANS, type KiroPlanId } from "@/lib/pricing";

// Which Kiro subscription plan to assume when computing plan-aware account cost
// (flat monthly fee + overage). A display/pricing preference, not user transcript
// data — so localStorage is fine (mirrors minConversationCost). See AGENTS.md
// rule 2: the invariant is about transcript content, which this is not.
const STORAGE_KEY = "tokenoptics:kiro-plan";

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

function isPlanId(v: string | null): v is KiroPlanId {
  return v !== null && v in KIRO_PLANS;
}

function getSnapshot(): KiroPlanId {
  const raw = localStorage.getItem(STORAGE_KEY);
  return isPlanId(raw) ? raw : DEFAULT_KIRO_PLAN_ID;
}

function getServerSnapshot(): KiroPlanId {
  return DEFAULT_KIRO_PLAN_ID;
}

export function useKiroPlan(): KiroPlanId {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function setKiroPlan(value: KiroPlanId): void {
  localStorage.setItem(STORAGE_KEY, value);
  for (const l of listeners) l();
}
