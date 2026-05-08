import { ConnectOrGoCTA } from "@/components/landing/ConnectOrGoCTA";
import { LogoMark } from "@/components/ui/LogoMark";

export function Hero() {
  return (
    <section className="border-b border-border-muted">
      <div className="mx-auto max-w-6xl px-8 pb-20 pt-24">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md border border-violet/40 bg-violet-subtle text-violet">
            <LogoMark className="h-5 w-5" />
          </div>
          <span className="text-base font-semibold tracking-tight text-fg">
            tokenoptics
          </span>
        </div>

        <h1 className="mt-12 max-w-3xl text-5xl font-semibold leading-[1.05] tracking-tight text-fg sm:text-6xl">
          Where did all your{" "}
          <span className="text-violet">Claude Code</span> spend go?
        </h1>

        <p className="mt-6 max-w-2xl text-lg text-fg-muted">
          Token-level visibility into every session, branch, and project — built
          on the transcripts already sitting on your machine. Nothing uploaded.
          Nothing tracked.
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <ConnectOrGoCTA className="inline-flex items-center gap-2 rounded-md border border-violet bg-violet px-5 py-2.5 text-sm font-medium text-bg transition-opacity hover:opacity-90" />
          <a
            href="#demos"
            className="inline-flex items-center gap-2 rounded-md border border-accent/40 bg-bg px-5 py-2.5 text-sm font-medium text-accent transition-colors hover:bg-accent-subtle"
          >
            See it in action
          </a>
        </div>
      </div>
    </section>
  );
}
