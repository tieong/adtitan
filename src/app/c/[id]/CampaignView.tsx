"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Campaign, CampaignStats } from "@/lib/types";
import { AdCard } from "@/components/AdCard";
import { VideoStudio } from "@/components/VideoStudio";
import { Bars, Kpi } from "@/components/Kpi";
import { visitUrl } from "@/lib/client";
import { compact, pct } from "@/lib/format";

export function CampaignView({ initial }: { initial: Campaign }) {
  const [c, setC] = useState(initial);
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch(`/api/campaigns/${initial.id}`)
        .then((r) => r.json())
        .then((d) => {
          if (!alive || !d.campaign) return;
          setC(d.campaign);
          setStats(d.stats);
        })
        .catch(() => {});
    load();
    const id = setInterval(load, 3000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [initial.id]);

  const best = stats?.variants.reduce<{ i: number; ctr: number } | null>((b, v) => {
    if (v.impressions < 3) return b;
    const ctr = v.clicks / v.impressions;
    return !b || ctr > b.ctr ? { i: v.variant, ctr } : b;
  }, null);

  const shareUrl = typeof window !== "undefined" ? `${location.origin}/r/${c.id}?src=share` : "";

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex items-center gap-4">
          <span className="grid size-14 place-items-center rounded-2xl text-3xl" style={{ background: c.palette.bg, boxShadow: `inset 0 0 0 1px ${c.palette.accent}66` }}>
            {c.emoji}
          </span>
          <div>
            <div className="font-mono text-[11px] uppercase tracking-wider text-white/40">
              Campaign · {c.category} · billboard #{c.slot}
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">{c.name}</h1>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <button
            onClick={() => {
              navigator.clipboard.writeText(shareUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="rounded-xl border border-white/15 px-4 py-2 text-sm hover:bg-white/5"
          >
            {copied ? "Copied ✓" : "Copy tracked link"}
          </button>
          <a href={visitUrl(c, best?.i ?? 0, "campaign")} target="_blank" rel="noopener" className="rounded-xl border border-white/15 px-4 py-2 text-sm hover:bg-white/5">
            Open project ↗
          </a>
          <Link href={`/world?focus=${c.id}`} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-[#7cf7ff]">
            See it in the city →
          </Link>
        </div>
      </div>
      <p className="mt-4 max-w-2xl text-white/55">{c.description}</p>

      <div id="video" className="mt-8">
        <VideoStudio campaign={initial} />
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi label="Impressions" value={compact(stats?.impressions ?? 0)} hint="≥1s on screen in the city" />
        <Kpi label="Unique viewers" value={compact(stats?.uniqueViewers ?? 0)} />
        <Kpi label="Clicks" value={compact(stats?.clicks ?? 0)} hint="billboard clicks" />
        <Kpi label="CTR" value={pct(stats?.ctr ?? 0)} hint="clicks / impressions" />
        <Kpi label="Site visits" value={compact(stats?.visits ?? 0)} hint="via tracked links" />
      </div>

      <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium">Live traffic</h2>
          <span className="flex items-center gap-1.5 font-mono text-[11px] text-white/40">
            <span className="size-1.5 animate-pulse rounded-full bg-[#8cff7a]" /> updates every 3s · ClickHouse
          </span>
        </div>
        <Bars series={stats?.series ?? []} accent={c.palette.accent} />
      </div>

      <h2 className="mb-1 mt-10 text-xl font-semibold tracking-tight">A/B/C test</h2>
      <p className="mb-5 text-sm text-white/45">The billboard rotates the three AI variants. The one people click wins.</p>
      <div className="grid gap-5 md:grid-cols-3">
        {c.variants.map((_, i) => {
          const v = stats?.variants[i];
          const vctr = v && v.impressions ? v.clicks / v.impressions : 0;
          const winner = best?.i === i;
          return (
            <div key={i} className={`rounded-2xl border p-2.5 ${winner ? "border-[#8cff7a]/60" : "border-white/10"}`}>
              <AdCard campaign={c} variant={i} />
              <div className="flex items-center gap-3 px-1.5 pb-1 pt-3 font-mono text-xs text-white/50">
                <span className="font-semibold text-white">Variant {"ABC"[i]}</span>
                {winner && <span className="rounded-full bg-[#8cff7a] px-2 py-0.5 text-[10px] font-bold text-black">WINNING</span>}
                <span className="ml-auto">{v?.impressions ?? 0} views</span>
                <span>{v?.clicks ?? 0} clicks</span>
                <span className="text-white">{pct(vctr)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
