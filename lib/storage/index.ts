// Public type-only entry. The browser-backed implementation lives in
// "@/lib/storage/browser"; this file just re-exports the shared types so any
// non-browser-specific consumer can reference them without pulling in Dexie.
export {
  ConversationStoreMissingError,
  type ConversationStore,
  type HarnessConnection,
  type InsertChunkArgs,
  type ReplaceEfficiencyArgs,
  type UpdateChunkArgs,
} from "./types";
