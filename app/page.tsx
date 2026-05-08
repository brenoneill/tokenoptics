"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { LandingContent } from "@/components/landing/LandingContent";
import { getMounts } from "@/lib/storage/browser";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mounts = await getMounts();
        if (!cancelled && mounts.length > 0) {
          router.replace("/conversations");
        }
      } catch {
        // If the IndexedDB check fails, fall back to showing the landing.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return <LandingContent />;
}
