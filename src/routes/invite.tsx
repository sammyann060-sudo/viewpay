import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Copy, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Shell, useProfile } from "@/components/app/Shell";
import { supabase } from "@/integrations/supabase/client";
import { REFERRAL_BONUS } from "@/lib/viewpay";

export const Route = createFileRoute("/invite")({
  head: () => ({
    meta: [
      { title: "Invite friends — ViewPay" },
      {
        name: "description",
        content: "Invite friends to ViewPay and earn bonus points after their first approved task.",
      },
      { property: "og:title", content: "Invite friends — ViewPay" },
      {
        property: "og:description",
        content: "Invite friends and earn bonus points after their first approved task.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <Shell>{(uid) => <Invite userId={uid} />}</Shell>,
});

function Invite({ userId }: { userId: string }) {
  const profile = useProfile(userId);
  const count = useQuery({
    queryKey: ["ref-count", userId],
    queryFn: async () => (await supabase.rpc("my_referral_count")).data ?? 0,
  });
  const code = profile.data?.referral_code ?? "······";
  const link = typeof window !== "undefined" ? `${window.location.origin}/auth?ref=${code}` : "";

  async function share() {
    const text = `I'm earning on ViewPay by completing tasks. Join with my code ${code}: ${link}`;
    if (navigator.share) await navigator.share({ text }).catch(() => {});
    else {
      await navigator.clipboard.writeText(text);
      toast.success("Invite copied");
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-tight">
        Invite friends,
        <br />
        <span className="text-primary">earn {REFERRAL_BONUS} points</span> each.
      </h1>
      <p className="mt-3 text-muted-foreground">
        You get the bonus after your friend completes their first task that is approved by an
        administrator.
      </p>
      <div className="mt-8 rounded-3xl border border-border bg-card p-6 text-center">
        <p className="text-sm text-muted-foreground">Your code</p>
        <p className="mt-2 font-mono text-4xl font-bold tracking-[0.2em]">{code}</p>
        <div className="mt-6 flex gap-2">
          <Button
            variant="secondary"
            className="h-12 flex-1 rounded-xl"
            onClick={() => {
              navigator.clipboard.writeText(link);
              toast.success("Link copied");
            }}
          >
            <Copy className="h-4 w-4" /> Copy link
          </Button>
          <Button className="h-12 flex-1 rounded-xl font-bold" onClick={share}>
            <Share2 className="h-4 w-4" /> Share
          </Button>
        </div>
      </div>
      <div className="mt-4 rounded-3xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">Friends joined</p>
        <p className="text-3xl font-extrabold tabular">{count.data ?? 0}</p>
      </div>
    </div>
  );
}
