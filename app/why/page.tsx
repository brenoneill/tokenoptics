import {
  ArrowLeftIcon,
  ChartBarIcon,
  ClockIcon,
  CurrencyDollarIcon,
  ScaleIcon,
} from "@heroicons/react/24/outline";
import type { Metadata } from "next";
import Link from "next/link";

import { ConnectOrGoCTA } from "@/components/landing/ConnectOrGoCTA";

export const metadata: Metadata = {
  title: "Why now? — Tokenoptics",
  description:
    "Plans are a transitional pricing model. The meter is coming. Why developer transparency on AI spend matters today, before usage-based pricing becomes the default.",
};

export default function WhyPage() {
  return (
    <main className="border-t border-border-muted">
      <div className="mx-auto max-w-3xl px-8 py-20">
        <Link
          href="/landing"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-fg-muted transition-colors hover:text-fg"
        >
          <ArrowLeftIcon className="h-3.5 w-3.5" aria-hidden />
          Back to home
        </Link>

        <header className="mt-8 space-y-4">
          <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-violet">
            the why
          </div>
          <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-fg sm:text-5xl">
            You&rsquo;re on a plan today. The meter is coming.
          </h1>
          <p className="text-lg text-fg-muted">
            Subscriptions are a transitional pricing model. Frontier inference
            costs real money, and the bill is being deferred &mdash; not paid.
            The habits you&rsquo;re forming today are going to write
            tomorrow&rsquo;s invoices. Knowing what you spend now is how you
            stay in control when that changes.
          </p>
        </header>

        <div className="mt-16 space-y-14">
          <Argument
            icon={CurrencyDollarIcon}
            eyebrow="01 — the current state"
            title="The plan hides the meter."
          >
            <p>
              Almost every developer using AI today is on a flat-rate plan
              &mdash; Claude Pro, Claude Max, Cursor Pro, Copilot Business,
              Codex Plus. You hit an opaque rate limit, you wait, you keep
              going. The actual cost of each prompt is invisible by design.
            </p>
            <p>
              That doesn&rsquo;t mean it&rsquo;s free. It means{" "}
              <span className="text-fg">
                you&rsquo;re not the one paying directly today
              </span>
              . Model providers and the wrappers on top of them are absorbing a
              real per-token cost in exchange for capturing the next decade of
              developer behaviour. They are buying market share with subsidy,
              and the subsidy is enormous.
            </p>
          </Argument>

          <Argument
            icon={ClockIcon}
            eyebrow="02 — the timeline"
            title="Plans are a transitional pricing model."
          >
            <p>
              The unit economics don&rsquo;t pencil out at flat rates forever.
              Frontier inference is among the most expensive compute workloads
              on the planet, and the leading labs are reportedly burning
              billions a year on it. That isn&rsquo;t sustainable, and
              it&rsquo;s not meant to be: this is land-grab pricing.
            </p>
            <p>
              Once growth stabilises and the land grab ends, pricing follows
              gravity. Usage-based. Metered. Transparent. My guess is{" "}
              <span className="text-fg">12 to 24 months</span> before that
              becomes the default for most developer-tier products. It could
              be sooner. It could be longer. The direction is not in doubt.
            </p>
            <p className="text-fg-subtle">
              API users already live on the other side of that line: Opus is
              $5 / $25 per million input/output tokens. Sonnet is $3 / $15.
              Haiku is $1 / $5. A serious 4-hour Opus session is a real
              number, not a vibe.
            </p>
          </Argument>

          <Argument
            icon={ChartBarIcon}
            eyebrow="03 — what it looks like"
            title="What metering will actually feel like."
          >
            <p>
              The &ldquo;Refactor canvas state into Zustand&rdquo; session
              from the demo on the home page is a typical 2.5-hour deep-work
              block: ~220k input, 680k output, 38M cache reads. Priced through
              the actual API meter on Opus, it&rsquo;s about{" "}
              <span className="font-mono text-fg">$41</span>. On Sonnet,
              about <span className="font-mono text-fg">$25</span>. On Haiku,
              about <span className="font-mono text-fg">$8</span>.
            </p>
            <p>
              A team of ten developers running two or three sessions like that
              a day, on Opus, lands somewhere between $50 and $150 per dev per
              day. Call it{" "}
              <span className="text-fg">$1 &ndash; 3K per dev per month</span>,
              or $10 &ndash; 30K/month for a small team.
            </p>
            <p>
              Most engineering orgs will go through sticker shock exactly
              once. Then they&rsquo;ll start asking which work needed Opus and
              which didn&rsquo;t. That conversation is dramatically easier to
              have if someone already has the data.
            </p>
          </Argument>

          <Argument
            icon={ScaleIcon}
            eyebrow="04 — the compounding effect"
            title="Habits compound, even more than spend."
          >
            <p>
              The thing nobody tells you: you&rsquo;re not just spending tokens
              today, you&rsquo;re forming defaults. Which model you reach for
              first. How long you let an error-loop run before you cut your
              losses. When you fold and start fresh. When you spend ten
              messages explaining a problem instead of two.
            </p>
            <p>
              Those behaviours don&rsquo;t reset when the meter turns on. They
              multiply by a price per token. A developer who reflexively
              reaches for Opus on a one-line bugfix is burning subsidy today;
              tomorrow they&rsquo;re burning the budget at five times the rate
              of the developer next to them who knows when to drop a tier.
            </p>
            <p>
              The good news:{" "}
              <span className="text-fg">
                this is the most fixable cost lever you have
              </span>
              , and the easiest time to fix it is now, while it&rsquo;s still
              invisible. Form the habit before the bill hits.
            </p>
          </Argument>
        </div>

        <section className="mt-20 rounded-xl border border-accent/30 bg-bg-subtle/60 px-8 py-12 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-fg">
            Get ahead of the meter.
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-fg-muted">
            Tokenoptics reads the transcripts Claude Code already writes to
            your disk and tells you what each session, branch, chunk, and
            model actually cost. No upload, no account, no telemetry.
          </p>
          <div className="mt-6">
            <ConnectOrGoCTA className="inline-flex items-center gap-2 rounded-md border border-accent bg-accent px-5 py-2.5 text-sm font-medium text-bg transition-opacity hover:opacity-90" />
          </div>
        </section>
      </div>
    </main>
  );
}

interface ArgumentProps {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}

function Argument({ icon: Icon, eyebrow, title, children }: ArgumentProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md border border-violet/40 bg-violet-subtle/40 text-violet">
          <Icon className="h-4 w-4" aria-hidden />
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-fg-subtle">
            {eyebrow}
          </div>
          <h2 className="text-xl font-semibold tracking-tight text-fg">
            {title}
          </h2>
        </div>
      </div>
      <div className="space-y-3 text-sm leading-relaxed text-fg-muted">
        {children}
      </div>
    </section>
  );
}
