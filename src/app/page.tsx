import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Generator } from "@/components/Generator";
import { AdCard } from "@/components/AdCard";
import { listCampaigns } from "@/lib/db";
import { allTotals } from "@/lib/events";
import { compact, pct } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [campaigns, totals] = await Promise.all([listCampaigns().catch(() => []), allTotals().catch(() => new Map())]);
  const latest = [...campaigns].reverse().slice(0, 9);

  return (
    <div className="min-h-screen overflow-x-hidden">
      <Nav />
      <section className="relative">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,#1b2a55_0%,transparent_70%)]" />
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(#ffffff08_1px,transparent_1px),linear-gradient(90deg,#ffffff08_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
        <div className="mx-auto max-w-3xl px-5 pb-16 pt-20 sm:pt-28">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-white/55">
            <span className="size-1.5 rounded-full bg-[#8cff7a]" /> {campaigns.length} projects on billboards right now
          </p>
          <h1 className="text-balance text-5xl font-semibold leading-[1.02] tracking-tight sm:text-7xl">
            Your hack, on a <span className="text-[#7cf7ff]">billboard</span>.
          </h1>
          <p className="mt-6 max-w-xl text-pretty text-lg text-white/60">
            Paste a GitHub repo or a website. AI reads it, writes three ads and paints the visual. Ten seconds later it
            is live in a 3D city where every hacker walks past it.
          </p>
          <div className="mt-10">
            <Generator />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-24">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Live in the city</h2>
            <p className="mt-1 text-sm text-white/45">Every ad below is on a billboard. Walk past it, click it, it counts.</p>
          </div>
          <Link href="/world" className="text-sm text-[#7cf7ff] hover:text-white">
            Enter the city →
          </Link>
        </div>
        {latest.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center text-white/40">
            No billboards yet. Yours could be the first one people see.
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {latest.map((c) => {
              const t = totals.get(c.id);
              return (
                <Link key={c.id} href={`/c/${c.id}`} className="group block">
                  <AdCard campaign={c} className="ring-1 ring-white/10 transition group-hover:ring-white/30" />
                  <div className="mt-2.5 flex items-center gap-3 px-1 font-mono text-[11px] text-white/45">
                    <span className="text-white/80">{c.name}</span>
                    <span className="ml-auto">{compact(t?.impressions ?? 0)} views</span>
                    <span>{compact(t?.clicks ?? 0)} clicks</span>
                    <span>{pct(t?.impressions ? t.clicks / t.impressions : 0)} CTR</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <footer className="border-t border-white/5 py-8 text-center font-mono text-[11px] text-white/30">
        AdCity · built at the hackathon on Aiven PostgreSQL, ClickHouse & Valkey · OpenAI for copy and visuals
      </footer>
    </div>
  );
}
