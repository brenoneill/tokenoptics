"use client";

import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { Fragment, useEffect, useState, type FormEvent } from "react";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import { track } from "@vercel/analytics";

import { Input } from "@/components/ui/Input";
import { useFormspree } from "@/lib/hooks/useFormspree";
import {
  LIKE_KEY,
  UPDATES_SIGNUP_KEY,
  getPref,
  setPref,
  type LikePref,
  type UpdatesSignupPref,
} from "@/lib/storage/browser/prefs";

type Stage = "loading" | "ask-like" | "ask-signup" | "signed-up";

export function LikeCTA() {
  const [stage, setStage] = useState<Stage>("loading");
  const [signedUpEmail, setSignedUpEmail] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [email, setEmail] = useState("");

  const signup = useFormspree({
    formId: "mjglaldp",
    onSuccess: async (payload) => {
      const pref: UpdatesSignupPref = {
        email: payload.email as string,
        signedUpAt: new Date().toISOString(),
      };
      await setPref(UPDATES_SIGNUP_KEY, pref);
      setSignedUpEmail(pref.email);
      setStage("signed-up");
      setDialogOpen(false);
      setEmail("");
    },
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [liked, signedUp] = await Promise.all([
        getPref<LikePref>(LIKE_KEY),
        getPref<UpdatesSignupPref>(UPDATES_SIGNUP_KEY),
      ]);
      if (cancelled) return;
      if (signedUp) {
        setSignedUpEmail(signedUp.email);
        setStage("signed-up");
      } else if (liked) {
        setStage("ask-signup");
      } else {
        setStage("ask-like");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onLikeClick = () => {
    setStage("ask-signup");
    setDialogOpen(true);
    void (async () => {
      const pref: LikePref = { likedAt: new Date().toISOString() };
      await setPref(LIKE_KEY, pref);
    })();
    track("like_clicked", { source: "sidebar" });
  };

  const onSignupSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await signup.submit({ email, source: "sidebar-like-cta" });
  };

  if (stage === "loading") return null;

  if (stage === "signed-up") {
    return (
      <div className="flex items-start gap-2 rounded-md border border-violet/30 bg-violet-subtle/40 px-3 py-2 text-xs">
        <CheckCircleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden />
        <div className="min-w-0">
          <div className="font-medium text-fg">You&rsquo;re subscribed</div>
          {signedUpEmail ? (
            <div className="mt-0.5 truncate font-mono text-[10px] text-fg-subtle">
              {signedUpEmail}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  if (stage === "ask-signup") {
    return (
      <>
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="group flex w-full items-center gap-2 rounded-md border border-violet/30 bg-violet-subtle/40 px-3 py-2 text-left text-xs transition-colors hover:bg-violet-subtle/70"
        >
          <span aria-hidden className="text-lg leading-none">💌</span>
          <span className="min-w-0">
            <span className="block font-medium text-fg">Sign up for updates</span>
            <span className="mt-0.5 block text-fg-muted">
              Get notified when new things ship
            </span>
          </span>
        </button>

        <SignupDialog
          open={dialogOpen}
          onClose={() => {
            if (signup.status !== "submitting") {
              setDialogOpen(false);
              signup.reset();
            }
          }}
          email={email}
          setEmail={setEmail}
          onSubmit={onSignupSubmit}
          status={signup.status}
          error={signup.error}
        />
      </>
    );
  }

  return (
    <button
      type="button"
      onClick={onLikeClick}
      className="group flex w-full items-center gap-2 rounded-md border border-violet/30 bg-violet-subtle/40 px-3 py-2 text-left text-xs transition-colors hover:bg-violet-subtle/70"
    >
      <span aria-hidden className="text-lg leading-none">❤️</span>
      <span className="min-w-0">
        <span className="block font-medium text-fg">Like this?</span>
        <span className="mt-0.5 block text-fg-muted">Click to let me know</span>
      </span>
    </button>
  );
}

interface SignupDialogProps {
  open: boolean;
  onClose: () => void;
  email: string;
  setEmail: (v: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  status: "idle" | "submitting" | "success" | "error";
  error: string | null;
}

function SignupDialog({
  open,
  onClose,
  email,
  setEmail,
  onSubmit,
  status,
  error,
}: SignupDialogProps) {
  return (
    <Transition show={open} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        <TransitionChild
          as={Fragment}
          enter="transition-opacity duration-150"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="transition-opacity duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <DialogBackdrop className="fixed inset-0 bg-black/50" />
        </TransitionChild>

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <TransitionChild
            as={Fragment}
            enter="transition ease-out duration-150"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <DialogPanel className="w-full max-w-sm rounded-lg border border-border bg-bg shadow-xl">
              <form onSubmit={onSubmit}>
                <div className="px-5 py-4">
                  <DialogTitle className="flex items-center gap-2 text-base font-semibold text-fg">
                    <span aria-hidden className="text-lg leading-none">❤️</span>
                    Sign up for updates
                  </DialogTitle>
                  <p className="mt-2 text-sm text-fg-muted">
                    Thanks for the <span aria-hidden>❤️</span>
                    <span className="sr-only">heart</span>!
                    <br />
                    <br />
                    Drop your email and I&rsquo;ll let you know when
                    there&rsquo;s something new.
                  </p>
                  <p className="mt-2 text-xs text-fg-subtle">
                    If you want to get in touch use the Get in touch button in
                    the sidebar.
                  </p>
                  <div className="mt-4">
                    <Input
                      type="email"
                      name="email"
                      required
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={status === "submitting"}
                      aria-label="Email address"
                      autoFocus
                    />
                  </div>
                  {status === "error" && error ? (
                    <div className="mt-2 text-xs text-danger">{error}</div>
                  ) : null}
                </div>
                <div className="flex items-center justify-end gap-2 border-t border-border bg-bg-subtle/40 px-5 py-3">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={status === "submitting"}
                    className="rounded-md border border-border px-3 py-1.5 text-sm text-fg-muted transition-colors hover:bg-bg-emphasis hover:text-fg disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={status === "submitting" || email.length === 0}
                    className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {status === "submitting" ? "Sending…" : "Sign up"}
                  </button>
                </div>
              </form>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}
