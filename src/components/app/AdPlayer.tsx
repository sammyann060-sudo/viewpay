import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX, X, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { errMsg } from "@/lib/viewpay";

export type Ad = {
  id: string;
  title: string;
  advertiser: string;
  video_url: string;
  duration_sec: number;
  question: string;
  options: string[];
  points: number;
};

type Phase = "watch" | "quiz" | "result";

export function AdPlayer({
  ad,
  viewId,
  onClose,
}: {
  ad: Ad;
  viewId: string;
  onClose: (earned: boolean) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [watched, setWatched] = useState(0);
  const [muted, setMuted] = useState(true);
  const [phase, setPhase] = useState<Phase>("watch");
  const [picked, setPicked] = useState<number | null>(null);
  const [result, setResult] = useState<{
    correct: boolean;
    points: number;
    correct_index: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const order = useRef(shuffle(ad.options.map((_, i) => i)));

  // Count only real, visible playback time
  useEffect(() => {
    if (phase !== "watch") return;
    const t = setInterval(() => {
      const v = video.current;
      if (!v || v.paused || v.ended || document.hidden) return;
      setWatched((w) => {
        const n = w + 0.25;
        if (n >= ad.duration_sec) {
          v.pause();
          setPhase("quiz");
        }
        return n;
      });
    }, 250);
    const onHide = () => {
      if (document.hidden) video.current?.pause();
      else video.current?.play().catch(() => {});
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [phase, ad.duration_sec]);

  async function submit() {
    if (picked === null) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("complete_ad_view", {
      _view_id: viewId,
      _answer: picked,
    });
    setBusy(false);
    if (error) {
      toast.error(errMsg(error));
      return;
    }
    setResult(data as { correct: boolean; points: number; correct_index: number });
    setPhase("result");
  }

  const remaining = Math.max(0, Math.ceil(ad.duration_sec - watched));
  const pct = Math.min(100, (watched / ad.duration_sec) * 100);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center justify-between px-5 py-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Sponsored · {ad.advertiser}
          </p>
          <p className="font-bold">{ad.title}</p>
        </div>
        {phase !== "watch" || watched === 0 || failed ? (
          <button
            aria-label="Close"
            onClick={() => onClose(phase === "result")}
            className="rounded-full bg-secondary p-2"
          >
            <X className="h-5 w-5" />
          </button>
        ) : (
          <span className="rounded-full bg-secondary px-3 py-1.5 font-mono text-sm tabular">
            {remaining}s
          </span>
        )}
      </div>

      {phase === "watch" && (
        <div className="relative flex flex-1 flex-col justify-center">
          <video
            ref={video}
            src={ad.video_url}
            autoPlay
            muted={muted}
            playsInline
            disablePictureInPicture
            controlsList="nodownload noplaybackrate"
            onContextMenu={(e) => e.preventDefault()}
            onEnded={() => setPhase("quiz")}
            onError={() => setFailed(true)}
            className="aspect-video w-full bg-card object-contain"
          />
          {failed && (
            <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-muted-foreground">
              This ad couldn't load. Close it and try another.
            </p>
          )}
          <button
            aria-label={muted ? "Unmute" : "Mute"}
            onClick={() => setMuted(!muted)}
            className="absolute right-4 bottom-4 rounded-full bg-background/70 p-2.5"
          >
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
          <div className="absolute inset-x-0 bottom-0 h-1 bg-secondary">
            <div
              className="h-full bg-primary transition-[width] duration-200"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {phase === "quiz" && (
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-5">
          <p className="text-sm text-primary">Quick question for {ad.points} points</p>
          <h2 className="mt-2 text-2xl font-extrabold">{ad.question}</h2>
          <div className="mt-6 space-y-3">
            {order.current.map((i) => (
              <button
                key={i}
                onClick={() => setPicked(i)}
                className={`w-full rounded-xl border p-4 text-left font-medium transition ${picked === i ? "border-primary bg-primary/10" : "border-border bg-card hover:border-muted-foreground"}`}
              >
                {ad.options[i]}
              </button>
            ))}
          </div>
          <Button
            onClick={submit}
            disabled={picked === null || busy}
            className="mt-6 h-12 rounded-xl text-base font-bold"
          >
            {busy ? "Checking…" : "Submit answer"}
          </Button>
        </div>
      )}

      {phase === "result" && result && (
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-5 text-center">
          {result.correct ? (
            <CheckCircle2 className="h-16 w-16 text-success" />
          ) : (
            <XCircle className="h-16 w-16 text-destructive" />
          )}
          <h2 className="mt-4 text-3xl font-extrabold">
            {result.correct ? `+${result.points} points` : "Not quite"}
          </h2>
          <p className="mt-2 text-muted-foreground">
            {result.correct
              ? "Added to your wallet."
              : `The answer was “${ad.options[result.correct_index]}”. Try another ad.`}
          </p>
          <Button
            onClick={() => onClose(true)}
            className="mt-8 h-12 w-full rounded-xl text-base font-bold"
          >
            Watch another
          </Button>
        </div>
      )}
    </div>
  );
}

function shuffle<T>(a: T[]) {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j] as T, r[i] as T];
  }
  return r;
}
