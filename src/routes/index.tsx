import { createFileRoute, Link } from "@tanstack/react-router";
import { BriefcaseBusiness, CheckCircle2, ListChecks, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/app/Brand";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ViewPay — Find flexible online tasks" },
      {
        name: "description",
        content:
          "Choose flexible online tasks, submit proof of your work and get paid when it is approved.",
      },
      { property: "og:title", content: "ViewPay — Find flexible online tasks" },
      {
        property: "og:description",
        content: "Choose a task, submit your work and earn when it is approved.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const steps = [
  {
    icon: BriefcaseBusiness,
    title: "Choose",
    description: "Pick an available task that suits you.",
  },
  {
    icon: ListChecks,
    title: "Complete",
    description: "Follow clear instructions and do the work.",
  },
  { icon: CheckCircle2, title: "Submit", description: "Send a report and the requested proof." },
  { icon: Wallet, title: "Get paid", description: "Approved earnings go to your wallet." },
];

function Landing() {
  return (
    <main className="mx-auto max-w-lg px-5 py-8">
      <BrandLogo className="h-14 w-auto" />
      <section className="pt-16 pb-12">
        <p className="mb-4 inline-block rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
          Clear rewards for completed work
        </p>
        <h1 className="text-5xl font-extrabold leading-[1.02] tracking-tight">
          Good work <br />
          deserves <span className="text-primary">good pay.</span>
        </h1>
        <p className="mt-5 text-lg text-muted-foreground">
          Complete real tasks, submit your work for review and earn a clear reward when it is
          approved.
        </p>
        <div className="mt-8 flex gap-3">
          <Button
            asChild
            size="lg"
            className="h-14 flex-1 rounded-2xl text-base font-bold shadow-glow"
          >
            <Link to="/auth">Browse tasks</Link>
          </Button>
          <Button asChild size="lg" variant="secondary" className="h-14 rounded-2xl text-base">
            <Link to="/auth" search={{ mode: "login" }}>
              Log in
            </Link>
          </Button>
        </div>
      </section>
      <section className="grid grid-cols-2 gap-3">
        {steps.map((step, index) => (
          <article key={step.title} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <step.icon className="h-6 w-6 text-primary" />
              <span className="font-mono text-xs text-muted-foreground">0{index + 1}</span>
            </div>
            <h2 className="mt-4 font-bold">{step.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
          </article>
        ))}
      </section>
      <p className="mt-10 text-center text-xs text-muted-foreground">
        Your task, your work, your reward.
      </p>
    </main>
  );
}
