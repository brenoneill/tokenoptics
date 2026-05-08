"use client";

import { useEffect, useState } from "react";

interface Props {
  iso: string;
}

// Renders an absolute date on first paint (stable across SSR + hydration),
// then swaps to a "Xm ago" relative string after mount. Doing the relative
// formatting at render time would call Date.now() twice (server + client) and
// trip a hydration mismatch when the two render moments fall on opposite
// sides of a minute boundary.
export function RelativeTime({ iso }: Props) {
  const initial = absoluteFallback(iso);
  const [text, setText] = useState<string>(initial);
  useEffect(() => {
    setText(formatRelative(iso));
  }, [iso]);
  return <span>{text}</span>;
}

function absoluteFallback(iso: string): string {
  // Locale-free, timezone-free slice of the ISO string ("2026-05-03"). Used
  // only for the brief moment between SSR and the first useEffect tick, so
  // server and client agree byte-for-byte.
  if (!iso) return "—";
  return iso.slice(0, 10);
}

function formatRelative(iso: string): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diffMs = Date.now() - then;
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
