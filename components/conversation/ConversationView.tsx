"use client";

import { useMemo, useState } from "react";

import { colorForChunkIndex, type ChunkColor } from "@/lib/labeling/colors";
import type { Chunk } from "@/lib/labeling/types";
import { computeScopeStats } from "@/lib/efficiency/scopeStats";
import { useModelComparisonEnabled } from "@/lib/preferences/modelComparison";
import { groupMessages } from "@/lib/transcript";
import type { Message } from "@/lib/types";
import { ChunkFilterBar, type ChunkPillModel } from "./ChunkFilterBar";
import { CollapsedFold } from "./CollapsedFold";
import { FloatingLabeler } from "./FloatingLabeler";
import { ModelComparisonBar } from "./ModelComparisonBar";
import { PromptBlock, type ChunkBadge } from "./PromptBlock";
import { SelectionProvider } from "./SelectionContext";
import { StatBar } from "./StatBar";

interface Props {
  projectId: string;
  sessionId: string;
  messages: Message[];
  chunks: Chunk[];
  onChunksChanged: () => void;
  // Credit-metered (Kiro) session. Drives credit-native stats even when this
  // particular session recorded zero credits — keyed off harness, not amount.
  isCredits?: boolean;
}

export function ConversationView({
  projectId,
  sessionId,
  messages,
  chunks,
  onChunksChanged,
  isCredits = false,
}: Props) {
  const [selectedChunkId, setSelectedChunkId] = useState<string | null>(null);
  const modelComparisonEnabled = useModelComparisonEnabled();

  const pills: ChunkPillModel[] = useMemo(
    () => chunks.map((chunk, idx) => ({ chunk, color: colorForChunkIndex(idx) })),
    [chunks],
  );

  const colorByChunkId = useMemo(() => {
    const map = new Map<string, ChunkColor>();
    for (const p of pills) map.set(p.chunk.id, p.color);
    return map;
  }, [pills]);

  // promptUuid → chunk badges (one per chunk this prompt belongs to).
  const badgesByPromptUuid = useMemo(() => {
    const map = new Map<string, ChunkBadge[]>();
    for (const { chunk, color } of pills) {
      const active = selectedChunkId === chunk.id;
      for (const uuid of chunk.memberMsgUuids) {
        const existing = map.get(uuid);
        const badge: ChunkBadge = {
          id: chunk.id,
          title: chunk.title,
          color: color.dot,
          active,
        };
        if (existing) existing.push(badge);
        else map.set(uuid, [badge]);
      }
    }
    return map;
  }, [pills, selectedChunkId]);

  const selectedChunk = useMemo(
    () => chunks.find((c) => c.id === selectedChunkId) ?? null,
    [chunks, selectedChunkId],
  );

  const visibleMessages = useMemo(() => {
    if (!selectedChunk) return messages;
    const allowed = new Set(selectedChunk.memberMsgUuids);
    return messages.filter((m) => allowed.has(m.uuid));
  }, [messages, selectedChunk]);

  const stats = useMemo(() => {
    const s = computeScopeStats(visibleMessages);
    // Force credit-native rendering for Kiro sessions even if zero credits were
    // recorded — the harness, not the amount, determines the metering model.
    return isCredits ? { ...s, isCredits: true } : s;
  }, [visibleMessages, isCredits]);

  const select = (chunkId: string) => {
    setSelectedChunkId((prev) => (prev === chunkId ? null : chunkId));
  };
  const clear = () => setSelectedChunkId(null);

  const grouped = groupMessages(visibleMessages);
  const activeColor = selectedChunk ? colorByChunkId.get(selectedChunk.id) : undefined;

  return (
    <SelectionProvider>
      <div className="space-y-4">
        <StatBar
          scopeLabel={selectedChunk ? selectedChunk.title : "Conversation"}
          stats={stats}
          color={activeColor}
        />
        {modelComparisonEnabled && !stats.isCredits ? (
          <ModelComparisonBar messages={visibleMessages} color={activeColor} />
        ) : null}
        <ChunkFilterBar
          pills={pills}
          selectedId={selectedChunkId}
          onSelect={select}
          onClear={clear}
          onChunksChanged={onChunksChanged}
        />
        <div className="space-y-3">
          {grouped.map((item, idx) => {
            if (item.kind === "prompt") {
              return (
                <PromptBlock
                  key={item.message.uuid}
                  text={item.text}
                  message={item.message}
                  trigger={item.trigger}
                  chunkBadges={badgesByPromptUuid.get(item.message.uuid)}
                />
              );
            }
            return (
              <CollapsedFold
                key={`fold-${idx}-${item.items[0]?.message.uuid ?? ""}`}
                items={item.items}
                toolResultCount={item.toolResultCount}
                assistantOutputCount={item.assistantOutputCount}
                assistantMessageCount={item.assistantMessageCount}
                diffCount={item.diffCount}
                addedLines={item.addedLines}
                removedLines={item.removedLines}
                rewrittenLines={item.rewrittenLines}
                totalCost={item.totalCost}
                totalCredits={item.totalCredits}
              />
            );
          })}
        </div>
      </div>
      <FloatingLabeler
        projectId={projectId}
        sessionId={sessionId}
        messages={messages}
        onSaved={onChunksChanged}
      />
    </SelectionProvider>
  );
}
