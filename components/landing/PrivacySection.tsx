import {
  CodeBracketIcon,
  FolderIcon,
  LockClosedIcon,
} from "@heroicons/react/24/outline";
import type { ComponentType, ReactNode, SVGProps } from "react";

interface Pillar {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  body: ReactNode;
}

const PILLARS: Pillar[] = [
  {
    icon: FolderIcon,
    title: "Built on data you already have",
    body: "Claude Code logs every session — every token, cache read, and model — to ~/.claude/projects. Tokenoptics indexes those files in your browser to surface what they've been recording all along.",
  },
  {
    icon: LockClosedIcon,
    title: "Nothing leaves your device",
    body: "No server, no upload, no telemetry, no account — every byte of analysis runs in your browser. Disconnect any time and your data stays exactly where it was.",
  },
  {
    icon: CodeBracketIcon,
    title: "Open-source — verify it yourself",
    body: (
      <>
        Every line of analysis logic is auditable. Don&apos;t trust us — read
        the full source on{" "}
        <a
          href="https://github.com/brenoneill/tokenoptics"
          target="_blank"
          rel="noopener noreferrer"
          className="text-violet underline underline-offset-2 hover:no-underline"
        >
          GitHub
        </a>
        .
      </>
    ),
  },
];

export function PrivacySection() {
  return (
    <section className="border-y border-border-muted bg-bg-subtle/40">
      <div className="mx-auto max-w-6xl px-8 py-16">
        <div className="max-w-2xl">
          <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-violet">
            local-first, by design
          </div>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-fg">
            Your transcripts never leave your machine.
          </h2>
        </div>

        <div className="mt-10 grid gap-8 md:grid-cols-3">
          {PILLARS.map((p) => (
            <div key={p.title} className="space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md border border-violet/40 bg-violet-subtle/40 text-violet">
                <p.icon className="h-5 w-5" aria-hidden />
              </div>
              <h3 className="text-base font-semibold text-fg">{p.title}</h3>
              <p className="text-sm leading-relaxed text-fg-muted">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
