"use client";

import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { Fragment, type ReactNode } from "react";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

// Right-side slide-in panel built on Headless UI's Dialog. The footer slot
// stays pinned to the bottom so save/cancel actions are always reachable while
// the body scrolls.
export function Sheet({ open, onClose, title, description, children, footer }: SheetProps) {
  return (
    <Transition show={open} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        <TransitionChild
          as={Fragment}
          enter="transition-opacity duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="transition-opacity duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <DialogBackdrop className="fixed inset-0 bg-black/40" />
        </TransitionChild>

        <div className="fixed inset-y-0 right-0 flex w-full max-w-md">
          <TransitionChild
            as={Fragment}
            enter="transform transition ease-out duration-250"
            enterFrom="translate-x-full"
            enterTo="translate-x-0"
            leave="transform transition ease-in duration-200"
            leaveFrom="translate-x-0"
            leaveTo="translate-x-full"
          >
            <DialogPanel className="flex h-full w-full flex-col border-l border-border bg-bg shadow-xl">
              <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
                <div className="min-w-0">
                  <DialogTitle className="text-base font-semibold text-fg">
                    {title}
                  </DialogTitle>
                  {description ? (
                    <div className="mt-1 text-sm text-fg-muted">{description}</div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="-m-1 rounded-md p-1 text-fg-subtle transition-colors hover:bg-bg-emphasis hover:text-fg"
                >
                  <XMarkIcon className="h-5 w-5" aria-hidden />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

              {footer ? (
                <div className="border-t border-border bg-bg-subtle/40 px-5 py-3">
                  {footer}
                </div>
              ) : null}
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}
