import { claudeCodeHarness } from "./claudeCode";
import { kiroCliHarness } from "./kiroCli";
import type { Harness } from "./types";

export const HARNESSES: Harness[] = [claudeCodeHarness, kiroCliHarness];

export function getHarness(id: string): Harness | undefined {
  return HARNESSES.find((h) => h.id === id);
}

export type { DiscoveredSession, FolderEntry, FolderReader, Harness, SessionLocator } from "./types";
