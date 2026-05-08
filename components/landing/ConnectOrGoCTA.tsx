"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getMounts } from "@/lib/storage/browser";

export function ConnectOrGoCTA({ className }: { className: string }) {
  const [hasMount, setHasMount] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mounts = await getMounts();
        if (!cancelled) setHasMount(mounts.length > 0);
      } catch {
        // Leave the default "Connect a folder" CTA on failure.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return hasMount ? (
    <Link href="/conversations" className={className}>
      Go to Conversations
    </Link>
  ) : (
    <Link href="/connect" className={className}>
      Connect a folder
    </Link>
  );
}
