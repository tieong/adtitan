"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { Campaign, CampaignStats } from "@/lib/types";
import { AdCard } from "@/components/AdCard";
import { VideoStudio } from "@/components/VideoStudio";
import { Avatar } from "@/components/lime/ui/avatar";
import { Badge } from "@/components/lime/ui/badge";
import { buttonVariants } from "@/components/lime/ui/button";
import { CopyButton } from "@/components/lime/ui/copy-button";
import { Insight } from "@/components/lime/ai/insight";
import { Segmented, SegmentedItem } from "@/components/lime/ui/segmented";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/lime/ui/table";
import { Icon, Launch } from "@/components/lime/icon";
import { visitUrl } from "@/lib/client";
import { imageUrl, pct } from "@/lib/format";

const LETTERS = ["A", "B", "C"];

export function CampaignView({ initial }: { initial: Campaign }) {
  const isNew = useSearchParams().get("new") === "1";
  const [c, setC] = useState(initial);
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [variant, setVariant] = useState(0);
  const [origin, setOrigin] = useState("");

  useEffect(() => setOrigin(location.origin), []);
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
    const id = setInterval(load, 4000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [initial.id]);

  // The variant with the best click-through once it has enough views to mean something.
  const winner = stats?.variants.reduce<{ i: number; ctr: number } | null>((b, v) => {
    if (v.impressions < 3) return b;
    const ctr = v.clicks / v.impressions;
    return !b || ctr > b.ctr ? { i: v.variant, ctr } : b;
  }, null);

  const shareUrl = `${origin}/r/${c.id}?src=share`;
  const views = stats?.impressions ?? 0;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 pt-6 pb-16 sm:px-6 sm:pt-10">
      <div className="flex flex-wrap items-start gap-4">
        <Avatar size="lg" name={c.name} src={imageUrl(c) ?? undefined} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="text-xl leading-tight font-semibold tracking-tight sm:text-2xl">{c.name}</h1>
          <p className="max-w-2xl text-sm text-fg-2">{c.description}</p>
        </div>
        <a href={visitUrl(c, winner?.i ?? 0, "campaign")} target="_blank" rel="noopener" className={buttonVariants({ variant: "outline", size: "sm" })}>
          <Icon icon={Launch} size={16} />
          Open the project
        </a>
      </div>

      <VideoStudio campaign={initial} autoStart={isNew} />

      <section className="flex flex-col gap-4" aria-labelledby="billboards-heading">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="billboards-heading" className="me-auto text-lg font-semibold">
            Billboard ads
          </h2>
          <Segmented size="sm" value={String(variant)} onValueChange={(v) => setVariant(Number(v))} aria-label="Ad variant">
            {c.variants.map((_, i) => (
              <SegmentedItem key={i} value={String(i)}>
                Variant {LETTERS[i]}
              </SegmentedItem>
            ))}
          </Segmented>
        </div>
        <div className="max-w-3xl">
          <AdCard campaign={c} variant={variant} />
        </div>
        <p className="max-w-2xl text-sm text-fg-2">
          The billboards in the city rotate the three variants. Each view and click is counted per variant, so the one
          people actually click rises to the top.
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Variant</TableHead>
              <TableHead className="text-end">Views</TableHead>
              <TableHead className="text-end">Clicks</TableHead>
              <TableHead className="text-end">Click rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {c.variants.map((v, i) => {
              const s = stats?.variants[i];
              return (
                <TableRow key={i} className={winner?.i === i ? "bg-accent-wash" : undefined}>
                  <TableCell>
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        {LETTERS[i]}. {v.headline}
                      </span>
                      {winner?.i === i && <Badge variant="success">Most clicked</Badge>}
                    </span>
                  </TableCell>
                  <TableCell className="text-end">{s?.impressions ?? 0}</TableCell>
                  <TableCell className="text-end">{s?.clicks ?? 0}</TableCell>
                  <TableCell className="text-end">{pct(s && s.impressions ? s.clicks / s.impressions : 0)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </section>

      <section className="flex max-w-2xl flex-col gap-4" aria-labelledby="perf-heading">
        <h2 id="perf-heading" className="text-lg font-semibold">
          How it is doing
        </h2>
        <p className="text-sm text-fg">
          {views === 0
            ? "Nobody has seen this ad yet. Share the link below or walk past its billboard in the city."
            : `${stats?.uniqueViewers === 1 ? "1 person" : `${stats?.uniqueViewers ?? 0} people`} saw this ad and ${stats?.visits ?? 0} went on to open the project.`}
        </p>
        <Insight
          title="Views in the last 30 minutes"
          figure={`${views} views`}
          basis={`${stats?.clicks ?? 0} clicks, ${pct(stats?.ctr ?? 0)} click rate`}
          points={(stats?.series ?? []).map((p) => p.impressions)}
        />
      </section>

      <section className="flex max-w-2xl flex-col gap-3" aria-labelledby="share-heading">
        <h2 id="share-heading" className="text-lg font-semibold">
          Share it
        </h2>
        <p className="text-sm text-fg-2">
          This link opens your project and counts the visit, so you can see which channel brings people.
        </p>
        <div className="flex flex-wrap items-center gap-2 rounded-field bg-surface p-2 ps-4">
          <code className="min-w-0 flex-1 truncate text-sm">{shareUrl}</code>
          <CopyButton value={shareUrl} label="Copy link" variant="secondary" size="sm">
            Copy link
          </CopyButton>
        </div>
        <Link href={`/world?focus=${c.id}`} className={buttonVariants({ variant: "ghost", size: "sm", className: "self-start" })}>
          Find its billboard in the city
        </Link>
      </section>
    </main>
  );
}
