"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { LandingContent } from "@/components/landing/LandingContent";
import { getMounts } from "@/lib/storage/browser";

export default function Home() {
  const router = useRouter();
  const [showLanding, setShowLanding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mounts = await getMounts();
        if (cancelled) return;
        if (mounts.length > 0) {
          router.replace("/conversations");
        } else {
          setShowLanding(true);
        }
      } catch {
        if (!cancelled) setShowLanding(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!showLanding) return <div className="min-h-screen bg-bg" />;
  return <LandingContent />;
}
