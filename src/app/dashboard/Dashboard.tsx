"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Campaign } from "@/lib/types";
import { Kpi } from "@/components/Kpi";
import { compact, pct } from "@/lib/format";

type Row = Campaign & { stats: { impressions: number; clicks: number; visits: number; uniqueViewers: number; ctr: number } };
type Global = { campaigns: number; impressions: number; clicks: number; visits: number; ctr: number; players: number };
type SortKey = "impressions" | "clicks" | "ctr" | "visits";

export function Dashboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [g, setG] = useState<Global | null>(null);
  const [sort, setSort] = useState<SortKey>("impressions");

  useEffect(() => {
    let alive = true;
    const load = () =>
      Promise.all([fetch("/api/campaigns").then((r) => r.json()), fetch("/api/stats").then((r) => r.json())])
        .then(([cs, st]) => {
          if (!alive) return;
          setRows(cs);
          setG(st);
        })
        .catch(() => {});
    load();
    const id = setInterval(load, 3000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const sorted = [...rows].sort((a, b) => b.stats[sort] - a.stats[sort] || b.stats.impressions - a.stats.impressions);
  const max = Math.max(1, ...rows.map((r) => r.stats[sort]));
  const fmt = (k: SortKey, n: number) => (k === "ctr" ? pct(n) : compact(n));

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <div className="flex items-end justify-between">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-wider text-white/40">Hackathon-wide</div>
          <h1 className="text-3xl font-semibold tracking-tight">Ad analytics</h1>
        </div>
        <span className="flex items-center gap-1.5 font-mono text-[11px] text-white/40">
          <span className="size-1.5 animate-pulse rounded-full bg-[#8cff7a]" /> live
        </span>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-6">
        <Kpi label="Campaigns" value={compact(g?.campaigns ?? 0)} />
        <Kpi label="In the city now" value={compact(g?.players ?? 0)} hint="Valkey presence" />
        <Kpi label="Impressions" value={compact(g?.impressions ?? 0)} />
        <Kpi label="Clicks" value={compact(g?.clicks ?? 0)} />
        <Kpi label="CTR" value={pct(g?.ctr ?? 0)} />
        <Kpi label="Site visits" value={compact(g?.visits ?? 0)} />
      </div>

      <div className="mt-10 flex items-center justify-between">
        <h2 className="text-xl font-semibold tracking-tight">Leaderboard</h2>
        <div className="flex rounded-xl border border-white/10 p-1">
          {(["impressions", "clicks", "ctr", "visits"] as SortKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setSort(k)}
              className={`rounded-lg px-3 py-1.5 font-mono text-xs capitalize ${sort === k ? "bg-white text-black" : "text-white/55 hover:text-white"}`}
            >
              {k === "ctr" ? "CTR" : k}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
        <div className="grid grid-cols-[2rem_1fr_5rem_5rem_4.5rem_5rem] gap-3 border-b border-white/10 bg-white/[0.02] px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider text-white/40 max-sm:grid-cols-[2rem_1fr_5rem]">
          <span>#</span>
          <span>Project</span>
          <span className="text-right">Views</span>
          <span className="text-right max-sm:hidden">Clicks</span>
          <span className="text-right max-sm:hidden">CTR</span>
          <span className="text-right max-sm:hidden">Visits</span>
        </div>
        {sorted.length === 0 && <div className="p-8 text-center text-sm text-white/40">No campaigns yet.</div>}
        {sorted.map((r, i) => (
          <Link
            key={r.id}
            href={`/c/${r.id}`}
            className="relative grid grid-cols-[2rem_1fr_5rem_5rem_4.5rem_5rem] items-center gap-3 border-b border-white/5 px-4 py-3 last:border-0 hover:bg-white/[0.03] max-sm:grid-cols-[2rem_1fr_5rem]"
          >
            <div
              className="pointer-events-none absolute inset-y-0 left-0 opacity-[0.12]"
              style={{ width: `${(r.stats[sort] / max) * 100}%`, background: r.palette.accent }}
            />
            <span className="font-mono text-xs text-white/40">{i + 1}</span>
            <span className="flex min-w-0 items-center gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg" style={{ background: r.palette.bg }}>
                {r.emoji}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{r.name}</span>
                <span className="block truncate text-xs text-white/40">{r.variants[0]?.headline}</span>
              </span>
            </span>
            <span className="text-right font-mono text-sm tabular-nums">{fmt("impressions", r.stats.impressions)}</span>
            <span className="text-right font-mono text-sm tabular-nums max-sm:hidden">{fmt("clicks", r.stats.clicks)}</span>
            <span className="text-right font-mono text-sm tabular-nums max-sm:hidden">{fmt("ctr", r.stats.ctr)}</span>
            <span className="text-right font-mono text-sm tabular-nums max-sm:hidden">{fmt("visits", r.stats.visits)}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
