"use client";

import {
  setIncludeChunkSummary,
  setIncludeChunkType,
  useIncludeChunkSummary,
  useIncludeChunkType,
} from "@/lib/preferences/chunkDisplay";
import { SettingToggle } from "./SettingToggle";

export function ChunkDisplayToggles() {
  const includeType = useIncludeChunkType();
  const includeSummary = useIncludeChunkSummary();

  return (
    <>
      <SettingToggle
        label="Include chunk type"
        description="When on, the chunk create/edit forms include a Type field and the type badge appears in chunk cards. Title is always shown."
        enabled={includeType}
        onChange={setIncludeChunkType}
      />
      <SettingToggle
        label="Include chunk summary"
        description="When on, the chunk create/edit forms include a Summary field and the summary text appears in chunk cards."
        enabled={includeSummary}
        onChange={setIncludeChunkSummary}
      />
    </>
  );
}
