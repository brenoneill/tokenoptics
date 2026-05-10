"use client";

import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { Fragment, useState, type FormEvent } from "react";
import {
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";

import { Input } from "@/components/ui/Input";
import { useFormspree } from "@/lib/hooks/useFormspree";

export function GetInTouch() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const contact = useFormspree({
    formId: "mjglpokl",
  });

  const onClose = () => {
    if (contact.status === "submitting") return;
    setOpen(false);
    if (contact.status !== "success") {
      contact.reset();
    }
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const ok = await contact.submit({
      name,
      email,
      message,
      source: "connect-get-in-touch",
    });
    if (ok) {
      setName("");
      setEmail("");
      setMessage("");
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          contact.reset();
          setOpen(true);
        }}
        className="group flex w-full items-center gap-2 rounded-md border border-border bg-bg-subtle/60 px-3 py-2 text-left text-xs transition-colors hover:bg-bg-emphasis"
      >
        <ChatBubbleLeftRightIcon
          className="h-4 w-4 shrink-0 text-fg-subtle group-hover:text-fg-muted"
          aria-hidden
        />
        <span className="min-w-0">
          <span className="block font-medium text-fg">Get in touch</span>
          <span className="mt-0.5 block text-fg-muted">
            Send me a message
          </span>
        </span>
      </button>

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
              <DialogPanel className="w-full max-w-md rounded-lg border border-border bg-bg shadow-xl">
                {contact.status === "success" ? (
                  <div className="px-5 py-6">
                    <DialogTitle className="flex items-center gap-2 text-base font-semibold text-fg">
                      <CheckCircleIcon
                        className="h-5 w-5 text-success"
                        aria-hidden
                      />
                      Message sent
                    </DialogTitle>
                    <p className="mt-2 text-sm text-fg-muted">
                      Thanks — I&rsquo;ll get back to you soon.
                    </p>
                    <div className="mt-5 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setOpen(false);
                          contact.reset();
                        }}
                        className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-bg transition-opacity hover:opacity-90"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={onSubmit}>
                    <div className="px-5 py-4">
                      <DialogTitle className="text-base font-semibold text-fg">
                        Get in touch
                      </DialogTitle>
                      <p className="mt-1 text-sm text-fg-muted">
                        Send me a message and I&rsquo;ll get back to you.
                      </p>
                      <div className="mt-4 flex flex-col gap-3">
                        <Input
                          type="text"
                          name="name"
                          required
                          placeholder="Your name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          disabled={contact.status === "submitting"}
                          aria-label="Name"
                          autoFocus
                        />
                        <Input
                          type="email"
                          name="email"
                          required
                          placeholder="you@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          disabled={contact.status === "submitting"}
                          aria-label="Email address"
                        />
                        <textarea
                          name="message"
                          required
                          placeholder="What&rsquo;s on your mind?"
                          rows={5}
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          disabled={contact.status === "submitting"}
                          aria-label="Message"
                          className="w-full resize-y rounded-md border border-border bg-bg-subtle px-3 py-2 text-sm text-fg placeholder:text-fg-subtle outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
                        />
                      </div>
                      {contact.status === "error" && contact.error ? (
                        <div className="mt-2 text-xs text-danger">
                          {contact.error}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex items-center justify-end gap-2 border-t border-border bg-bg-subtle/40 px-5 py-3">
                      <button
                        type="button"
                        onClick={onClose}
                        disabled={contact.status === "submitting"}
                        className="rounded-md border border-border px-3 py-1.5 text-sm text-fg-muted transition-colors hover:bg-bg-emphasis hover:text-fg disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={
                          contact.status === "submitting" ||
                          name.length === 0 ||
                          email.length === 0 ||
                          message.length === 0
                        }
                        className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {contact.status === "submitting" ? "Sending…" : "Send"}
                      </button>
                    </div>
                  </form>
                )}
              </DialogPanel>
            </TransitionChild>
          </div>
        </Dialog>
      </Transition>
    </>
  );
}
