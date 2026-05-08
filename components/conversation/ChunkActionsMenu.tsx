"use client";

import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { EllipsisHorizontalIcon } from "@heroicons/react/24/outline";
import { useState } from "react";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { Chunk } from "@/lib/labeling/types";
import { getBrowserConversationStore } from "@/lib/storage/browser";
import { EditChunkSheet } from "./EditChunkSheet";

interface Props {
  chunk: Chunk;
  onChange: () => void;
}

export function ChunkActionsMenu({ chunk, onChange }: Props) {
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await getBrowserConversationStore().deleteChunk(chunk.id);
      setConfirmOpen(false);
      onChange();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Menu as="div" className="relative" onClick={(e) => e.stopPropagation()}>
        <MenuButton
          className="rounded-md p-1 text-fg-subtle transition-colors hover:bg-bg-emphasis hover:text-fg"
          aria-label="Chunk actions"
          onClick={(e) => e.stopPropagation()}
        >
          <EllipsisHorizontalIcon className="h-4 w-4" aria-hidden />
        </MenuButton>
        <MenuItems
          anchor="bottom end"
          className="z-40 mt-1 min-w-[8rem] rounded-md border border-border bg-bg shadow-lg outline-none"
        >
          <MenuItem>
            {({ focus }) => (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditOpen(true);
                }}
                className={`block w-full px-3 py-2 text-left text-sm ${
                  focus ? "bg-bg-emphasis text-fg" : "text-fg-muted"
                }`}
              >
                Edit
              </button>
            )}
          </MenuItem>
          <MenuItem>
            {({ focus }) => (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmOpen(true);
                }}
                className={`block w-full px-3 py-2 text-left text-sm ${
                  focus ? "bg-danger-subtle/60 text-danger" : "text-danger"
                }`}
              >
                Delete
              </button>
            )}
          </MenuItem>
        </MenuItems>
      </Menu>

      <EditChunkSheet
        chunk={chunk}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={onChange}
      />

      <ConfirmDialog
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Delete chunk?"
        body={
          <>
            <span className="font-medium text-fg">{chunk.title}</span> will be removed.
            The conversation messages stay untouched.
          </>
        }
        confirmLabel="Delete"
        destructive
        busy={deleting}
      />
    </>
  );
}
