import { createFileRoute, Link } from "@tanstack/react-router";
import { PlayCircle, HelpCircle, Coins, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ViewPay — Watch short ads, get paid to M-Pesa" },
      {
        name: "description",
        content:
          "Watch 15–30 second ads, answer one question and earn points. Cash out to M-Pesa in Kenya or USDT worldwide.",
      },
      { property: "og:title", content: "ViewPay — Watch short ads, get paid" },
      {
        property: "og:description",
        content:
          "Earn points for every ad you watch. Cash out to M-Pesa in Kenya or USDT worldwide.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const steps = [
  { icon: PlayCircle, t: "Watch", d: "A short ad, 15–30 seconds. No skipping." },
  { icon: HelpCircle, t: "Answer", d: "One quick question about what you saw." },
  { icon: Coins, t: "Earn", d: "5–20 points land in your wallet instantly." },
  { icon: Smartphone, t: "Cash out", d: "To M-Pesa from KSh 50, or USDT from $1." },
];

function Landing() {
  return (
    <div className="mx-auto max-w-lg px-5 py-8">
      <div className="text-xl font-extrabold tracking-tight">
        view<span className="text-primary">pay</span>
      </div>
      <section className="pt-16 pb-12">
        <p className="mb-4 inline-block rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
          500 points = KSh 100
        </p>
        <h1 className="text-5xl font-extrabold leading-[1.02] tracking-tight">
          Your attention <br />
          is worth <span className="text-primary">money.</span>
        </h1>
        <p className="mt-5 text-lg text-muted-foreground">
          Watch short ads, answer a quick question and earn points. Cash out to M-Pesa in Kenya or
          USDT worldwide.
        </p>
        <div className="mt-8 flex gap-3">
          <Button
            asChild
            size="lg"
            className="h-14 flex-1 rounded-2xl text-base font-bold shadow-glow"
          >
            <Link to="/auth">Start earning</Link>
          </Button>
          <Button asChild size="lg" variant="secondary" className="h-14 rounded-2xl text-base">
            <Link to="/auth" search={{ mode: "login" }}>
              Log in
            </Link>
          </Button>
        </div>
      </section>
      <section className="grid grid-cols-2 gap-3">
        {steps.map((s, i) => (
          <div key={s.t} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <s.icon className="h-6 w-6 text-primary" />
              <span className="font-mono text-xs text-muted-foreground">0{i + 1}</span>
            </div>
            <h3 className="mt-4 font-bold">{s.t}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
          </div>
        ))}
      </section>
      <p className="mt-10 text-center text-xs text-muted-foreground">
        Up to two accounts per browser · Up to 20 ads a day
      </p>
    </div>
  );
}
