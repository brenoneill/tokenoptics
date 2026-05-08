"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface SelectionContextValue {
  selected: ReadonlySet<string>;
  toggle: (uuid: string) => void;
  clear: () => void;
}

const SelectionContext = createContext<SelectionContextValue | null>(null);

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  const toggle = useCallback((uuid: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uuid)) next.delete(uuid);
      else next.add(uuid);
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);

  const value = useMemo<SelectionContextValue>(
    () => ({ selected, toggle, clear }),
    [selected, toggle, clear],
  );

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

// Returns the selection context if a SelectionProvider is in the tree, otherwise null.
// PromptBlock uses this to conditionally render a checkbox: present inside the labeling
// region, absent everywhere else (e.g. chunk card bodies).
export function useSelection(): SelectionContextValue | null {
  return useContext(SelectionContext);
}
