"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChatBubbleLeftRightIcon,
  Cog6ToothIcon,
  FolderOpenIcon,
} from "@heroicons/react/24/outline";
import type { ComponentType, SVGProps } from "react";

import { LikeCTA } from "./LikeCTA";
import { LogoMark } from "./LogoMark";

interface NavItem {
  label: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const NAV: NavItem[] = [
  { label: "Conversations", href: "/conversations", icon: ChatBubbleLeftRightIcon },
  { label: "Connect",       href: "/connect",       icon: FolderOpenIcon },
  { label: "Settings",      href: "/settings",      icon: Cog6ToothIcon },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col self-start border-r border-border bg-bg-subtle/40">
      <Link
        href="/landing"
        className="flex h-14 items-center gap-2 border-b border-border px-4 transition-colors hover:bg-bg-hover"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-md border border-violet/40 bg-violet-subtle text-violet">
          <LogoMark className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-semibold text-fg">tokenoptics</div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-fg-subtle">
            v0.1
          </div>
        </div>
      </Link>

      <nav className="flex flex-1 flex-col px-2 py-3">
        <div className="flex-1">
          {NAV.map((item) => {
            const active =
              pathname === item.href || pathname?.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group mb-0.5 flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-bg-emphasis text-fg"
                    : "text-fg-muted hover:bg-bg-hover hover:text-fg"
                }`}
              >
                <Icon
                  className={`h-4 w-4 ${active ? "text-accent" : "text-fg-subtle group-hover:text-fg-muted"}`}
                  aria-hidden
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
        <div className="px-1 pt-3">
          <LikeCTA />
        </div>
      </nav>

      <div className="border-t border-border px-4 py-3">
        <div className="font-mono text-[10px] uppercase tracking-wider text-fg-subtle">
          local · ~/.claude
        </div>
      </div>
    </aside>
  );
}
