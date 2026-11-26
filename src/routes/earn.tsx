import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Play, Check, Clock } from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/app/Shell";
import { AdPlayer, type Ad } from "@/components/app/AdPlayer";
import { supabase } from "@/integrations/supabase/client";
import { DAILY_LIMIT, errMsg } from "@/lib/viewpay";

export const Route = createFileRoute("/earn")({
  head: () => ({
    meta: [
      { title: "Watch & earn — ViewPay" },
      { name: "description", content: "Today's ads. Watch, answer and earn points." },
      { property: "og:title", content: "Watch & earn — ViewPay" },
      { property: "og:description", content: "Today's ads. Watch, answer and earn points." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <Shell>{(uid) => <Earn userId={uid} />}</Shell>,
});

function startOfNairobiDay() {
  const now = new Date();
  const eat = new Date(now.getTime() + 3 * 3600_000);
  eat.setUTCHours(0, 0, 0, 0);
  return new Date(eat.getTime() - 3 * 3600_000).toISOString();
}

function Earn({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [playing, setPlaying] = useState<{ ad: Ad; viewId: string } | null>(null);

  const ads = useQuery({
    queryKey: ["ads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ads")
        .select("id,title,advertiser,video_url,duration_sec,question,options,points")
        .eq("active", true)
        .order("points", { ascending: false });
      if (error) throw error;
      return data as Ad[];
    },
  });
  const views = useQuery({
    queryKey: ["views-today", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ad_views")
        .select("ad_id,correct,completed_at")
        .eq("user_id", userId)
        .gte("started_at", startOfNairobiDay())
        .not("completed_at", "is", null);
      if (error) throw error;
      return data;
    },
  });

  const done = new Set(views.data?.map((v) => v.ad_id));
  const earnedToday = views.data?.filter((v) => v.correct).length ?? 0;

  async function start(ad: Ad) {
    const { data, error } = await supabase.rpc("start_ad_view", { _ad_id: ad.id });
    if (error) {
      toast.error(errMsg(error));
      return;
    }
    setPlaying({ ad, viewId: data as string });
  }

  return (
    <div>
      <div className="rounded-3xl border border-border bg-card p-5">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Today</p>
            <p className="text-3xl font-extrabold tabular">
              {earnedToday}
              <span className="text-lg text-muted-foreground"> / {DAILY_LIMIT} ads</span>
            </p>
          </div>
          <p className="text-xs text-muted-foreground">Resets at midnight</p>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full bg-primary"
            style={{ width: `${(earnedToday / DAILY_LIMIT) * 100}%` }}
          />
        </div>
      </div>

      <h2 className="mt-8 mb-3 font-bold">Available ads</h2>
      {ads.isLoading && <p className="text-muted-foreground">Loading ads…</p>}
      {ads.data?.length === 0 && (
        <p className="text-muted-foreground">No ads right now. Check back soon.</p>
      )}
      <div className="space-y-3">
        {ads.data?.map((ad) => {
          const isDone = done.has(ad.id);
          return (
            <button
              key={ad.id}
              disabled={isDone}
              onClick={() => start(ad)}
              className="flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left transition hover:border-primary disabled:opacity-50 disabled:hover:border-border"
            >
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${isDone ? "bg-secondary" : "bg-primary text-primary-foreground"}`}
              >
                {isDone ? <Check className="h-5 w-5" /> : <Play className="h-5 w-5 fill-current" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{ad.title}</p>
                <p className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {ad.duration_sec}s · {ad.advertiser}
                </p>
              </div>
              <span className="rounded-full bg-accent/15 px-2.5 py-1 text-sm font-bold text-accent">
                +{ad.points}
              </span>
            </button>
          );
        })}
      </div>

      {playing && (
        <AdPlayer
          ad={playing.ad}
          viewId={playing.viewId}
          onClose={() => {
            setPlaying(null);
            qc.invalidateQueries({ queryKey: ["views-today"] });
            qc.invalidateQueries({ queryKey: ["profile"] });
          }}
        />
      )}
    </div>
  );
}
