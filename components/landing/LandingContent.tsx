import { ChunksSection } from "@/components/landing/ChunksSection";
import { ConnectOrGoCTA } from "@/components/landing/ConnectOrGoCTA";
import { Hero } from "@/components/landing/Hero";
import { LevelDemo } from "@/components/landing/LevelDemo";
import { ModelComparisonSection } from "@/components/landing/ModelComparisonSection";
import { PrivacySection } from "@/components/landing/PrivacySection";
import { WhyTeaserSection } from "@/components/landing/WhyTeaserSection";

export function LandingContent() {
  return (
    <main>
      <Hero />
      <PrivacySection />

      <div id="demos" className="mx-auto max-w-6xl space-y-24 px-8 py-24">
        <LevelDemo />
        <ChunksSection />
        <ModelComparisonSection />
        <WhyTeaserSection />

        <section className="rounded-xl border border-accent/30 bg-bg-subtle/60 px-8 py-12 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-fg">
            Ready to see your own numbers?
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-fg-muted">
            Connect your local <span className="font-mono">~/.claude</span>{" "}
            folder. Tokenoptics indexes it in your browser — no upload, no
            account.
          </p>
          <div className="mt-6">
            <ConnectOrGoCTA className="inline-flex items-center gap-2 rounded-md border border-accent bg-accent px-5 py-2.5 text-sm font-medium text-bg transition-opacity hover:opacity-90" />
          </div>
        </section>
      </div>
    </main>
  );
}
