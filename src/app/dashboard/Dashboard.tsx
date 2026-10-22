"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import NumberFlow from "@number-flow/react";
import type { Campaign } from "@/lib/types";
import { Avatar } from "@/components/lime/ui/avatar";
import { Segmented, SegmentedItem } from "@/components/lime/ui/segmented";
import { Skeleton } from "@/components/lime/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/lime/ui/table";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/lime/ui/empty";
import { imageUrl, pct } from "@/lib/format";

type Row = Campaign & { stats: { impressions: number; clicks: number; visits: number; uniqueViewers: number; ctr: number } };
type Global = { campaigns: number; impressions: number; clicks: number; visits: number; ctr: number; players: number };
type SortKey = "impressions" | "clicks" | "ctr" | "visits";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "impressions", label: "Views" },
  { key: "clicks", label: "Clicks" },
  { key: "ctr", label: "Click rate" },
  { key: "visits", label: "Visits" },
];

export function Dashboard() {
  const [rows, setRows] = useState<Row[] | null>(null);
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

  const sorted = [...(rows ?? [])].sort((a, b) => b.stats[sort] - a.stats[sort] || b.stats.impressions - a.stats.impressions);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pt-6 pb-16 sm:px-6 sm:pt-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-xl leading-tight font-semibold tracking-tight sm:text-2xl">Which ads people click</h1>
        {g ? (
          <p className="max-w-2xl text-base text-fg-2">
            <NumberFlow value={g.campaigns} className="font-medium text-fg" /> projects have been seen{" "}
            <NumberFlow value={g.impressions} className="font-medium text-fg" /> times and clicked{" "}
            <NumberFlow value={g.clicks} className="font-medium text-fg" /> times, a{" "}
            <span className="font-medium text-fg">{pct(g.ctr)}</span> click rate.{" "}
            <NumberFlow value={g.players} className="font-medium text-fg" /> {g.players === 1 ? "person is" : "people are"} walking
            the city right now.
          </p>
        ) : (
          <Skeleton className="max-w-md" />
        )}
      </div>

      <section className="flex flex-col gap-3" aria-labelledby="board-heading">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="board-heading" className="me-auto text-lg font-semibold">
            Leaderboard
          </h2>
          <Segmented size="sm" value={sort} onValueChange={(v) => setSort(v as SortKey)} aria-label="Sort by">
            {SORTS.map((s) => (
              <SegmentedItem key={s.key} value={s.key}>
                {s.label}
              </SegmentedItem>
            ))}
          </Segmented>
        </div>

        {rows === null ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <Empty>
            <EmptyTitle>No campaigns yet</EmptyTitle>
            <EmptyDescription>Once someone makes an ad, its views and clicks show up here.</EmptyDescription>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">Rank</TableHead>
                <TableHead>Project</TableHead>
                <TableHead className="text-end">Views</TableHead>
                <TableHead className="text-end max-sm:hidden">Clicks</TableHead>
                <TableHead className="text-end max-sm:hidden">Click rate</TableHead>
                <TableHead className="text-end max-sm:hidden">Visits</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((r, i) => (
                <TableRow key={r.id}>
                  <TableCell className="text-fg-2">{i + 1}</TableCell>
                  <TableCell>
                    <Link href={`/c/${r.id}`} className="flex min-w-0 items-center gap-3 hover:underline">
                      <Avatar size="sm" name={r.name} src={imageUrl(r) ?? undefined} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{r.name}</span>
                        <span className="block truncate text-fg-2">{r.variants[0]?.headline}</span>
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-end">{r.stats.impressions}</TableCell>
                  <TableCell className="text-end max-sm:hidden">{r.stats.clicks}</TableCell>
                  <TableCell className="text-end max-sm:hidden">{pct(r.stats.ctr)}</TableCell>
                  <TableCell className="text-end max-sm:hidden">{r.stats.visits}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </main>
  );
}
