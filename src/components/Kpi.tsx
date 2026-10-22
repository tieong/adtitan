export function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <div className="font-mono text-[11px] uppercase tracking-wider text-white/40">{label}</div>
      <div className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">{value}</div>
      {hint && <div className="mt-1 text-xs text-white/40">{hint}</div>}
    </div>
  );
}

/** Minute-bucket bar chart: impressions as bars, clicks as accent caps. */
export function Bars({ series, accent }: { series: { t: string; impressions: number; clicks: number }[]; accent: string }) {
  const max = Math.max(1, ...series.map((s) => s.impressions));
  return (
    <div>
      <div className="flex h-36 items-end gap-[3px]">
        {series.map((s) => (
          <div key={s.t} className="group relative flex h-full flex-1 flex-col justify-end" title={`${new Date(s.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · ${s.impressions} views · ${s.clicks} clicks`}>
            <div className="rounded-t-[3px] bg-white/15 transition group-hover:bg-white/30" style={{ height: `${(s.impressions / max) * 100}%`, minHeight: s.impressions ? 3 : 0 }}>
              {s.clicks > 0 && <div className="h-[3px] rounded-t-[3px]" style={{ background: accent }} />}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between font-mono text-[10px] text-white/30">
        <span>30 min ago</span>
        <span>now</span>
      </div>
    </div>
  );
}
