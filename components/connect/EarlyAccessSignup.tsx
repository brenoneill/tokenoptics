"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CheckCircleIcon, SparklesIcon } from "@heroicons/react/24/outline";

import { Input } from "@/components/ui/Input";
import { useFormspree } from "@/lib/hooks/useFormspree";
import {
  EARLY_ACCESS_BYOK_KEY,
  getPref,
  setPref,
  type EarlyAccessSignupPref,
} from "@/lib/storage/browser/prefs";

export function EarlyAccessSignup() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [signedUp, setSignedUp] = useState<EarlyAccessSignupPref | null>(null);

  const { status, error, submit } = useFormspree({
    formId: "xykodypn",
    onSuccess: async (payload) => {
      const pref: EarlyAccessSignupPref = {
        email: payload.email as string,
        signedUpAt: new Date().toISOString(),
      };
      await setPref(EARLY_ACCESS_BYOK_KEY, pref);
      setSignedUp(pref);
      setEmail("");
    },
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const pref = await getPref<EarlyAccessSignupPref>(EARLY_ACCESS_BYOK_KEY);
        if (cancelled) return;
        if (pref) setSignedUp(pref);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await submit({
      email,
      interest: "Early Release BYOK AI Key for AI Chunking and Labelling",
    });
  };

  return (
    <div className="rounded-md border border-violet/30 bg-violet-subtle/40 p-5">
      <div className="flex items-start gap-3">
        <SparklesIcon className="mt-0.5 h-5 w-5 shrink-0 text-violet" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-fg">
            Sign up for Early Release: BYOK AI Key for AI Chunking & Labelling
          </div>
          <p className="mt-1 text-sm text-fg-muted">
            Bring your own API key to automatically chunk and label conversations
            with AI. Drop your email if you&rsquo;d like early access.
          </p>

          {loading ? (
            <div className="mt-4 text-sm text-fg-muted">Loading…</div>
          ) : signedUp ? (
            <div className="mt-4 flex items-start gap-2 text-sm text-success">
              <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              <div>
                <div>You&rsquo;re on the list — we&rsquo;ll be in touch when early access opens.</div>
                <div className="mt-0.5 text-xs text-fg-muted">
                  Signed up as <span className="font-mono">{signedUp.email}</span>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Input
                type="email"
                name="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={status === "submitting"}
                aria-label="Email address"
              />
              <button
                type="submit"
                disabled={status === "submitting" || email.length === 0}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-violet bg-violet px-4 py-2 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {status === "submitting" ? "Sending…" : "Notify me"}
              </button>
            </form>
          )}

          {status === "error" && error ? (
            <div className="mt-2 text-xs text-danger">{error}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
