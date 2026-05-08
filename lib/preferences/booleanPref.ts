"use client";

import { useSyncExternalStore } from "react";

interface BooleanPref {
  use: () => boolean;
  set: (value: boolean) => void;
}

// Factory for an app-wide boolean preference backed by localStorage.
// Same-tab consumers stay in sync via an explicit listener set; cross-tab
// sync rides on the native `storage` event.
export function createBooleanPref(
  storageKey: string,
  defaultValue = false,
): BooleanPref {
  const listeners = new Set<() => void>();

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey) listener();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  }

  function getSnapshot(): boolean {
    const raw = localStorage.getItem(storageKey);
    if (raw === null) return defaultValue;
    return raw === "1";
  }

  function getServerSnapshot(): boolean {
    return defaultValue;
  }

  return {
    use: () => useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot),
    set: (value: boolean) => {
      localStorage.setItem(storageKey, value ? "1" : "0");
      for (const l of listeners) l();
    },
  };
}
