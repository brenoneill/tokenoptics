"use client";

import { Disclosure, DisclosureButton, DisclosurePanel } from "@headlessui/react";
import { ChevronRightIcon, SparklesIcon } from "@heroicons/react/24/outline";

interface Props {
  text: string;
}

export function ThinkingBlock({ text }: Props) {
  return (
    <Disclosure as="div" className="rounded-md border border-border-muted bg-bg-subtle/40">
      {({ open }) => (
        <>
          <DisclosureButton className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-fg-muted transition-colors hover:bg-bg-emphasis">
            <ChevronRightIcon
              className={`h-3 w-3 transition-transform ${open ? "rotate-90" : ""}`}
              aria-hidden
            />
            <SparklesIcon className="h-3.5 w-3.5 text-violet" aria-hidden />
            <span className="font-mono uppercase tracking-wider">thinking</span>
          </DisclosureButton>
          <DisclosurePanel className="border-t border-border-muted px-3 py-2">
            <div className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-fg-muted">
              {text}
            </div>
          </DisclosurePanel>
        </>
      )}
    </Disclosure>
  );
}
