import { ArrowRightIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

export function WhyTeaserSection() {
  return (
    <section className="rounded-xl border border-violet/30 bg-violet-subtle/30 px-8 py-10">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr),auto] lg:items-center">
        <div className="max-w-2xl space-y-3">
          <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-violet">
            the why
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-fg">
            Plans are temporary. The meter is coming.
          </h2>
          <p className="text-sm leading-relaxed text-fg-muted">
            Almost every AI-coding tool today is sold as a flat-rate
            subscription, but inference costs real money and the bill is being
            deferred &mdash; not paid. Once usage-based pricing becomes the
            norm, likely in the next 12 &ndash; 24 months, the habits
            you&rsquo;re forming today turn into invoices. Knowing what you
            spend now is how you stay in control when that changes.
          </p>
        </div>
        <Link
          href="/why"
          className="inline-flex items-center gap-2 self-start rounded-md border border-violet/40 bg-bg px-4 py-2 text-sm font-medium text-fg transition-colors hover:bg-bg-subtle lg:self-auto"
        >
          Read the full hypothesis
          <ArrowRightIcon className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </section>
  );
}
