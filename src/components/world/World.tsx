"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import Link from "next/link";
import type { Campaign, Player } from "@/lib/types";
import { me as getMe, visitUrl, type Me } from "@/lib/client";
import { AdCard } from "@/components/AdCard";
import { Avatar } from "@/components/lime/ui/avatar";
import { Button, buttonVariants } from "@/components/lime/ui/button";
import { List, ListItem } from "@/components/lime/ui/list";
import { imageUrl } from "@/lib/format";
import { LIMIT, slots, viewpoint } from "./city";
import { Scene, type Pose } from "./Scene";
import { Tracker } from "./tracker";

const SPAWN: Pose = { x: 0, z: 20, ry: Math.PI };

export default function World({ focusId }: { focusId: string | null }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [selected, setSelected] = useState<{ c: Campaign; v: number } | null>(null);
  const [teleport, setTeleport] = useState<Pose | null>(null);
  const [seen, setSeen] = useState(0);
  const [listOpen, setListOpen] = useState(true);
  const pose = useRef<Pose>({ ...SPAWN });
  const tracker = useMemo(() => (me ? new Tracker(me.id) : null), [me]);

  useEffect(() => setMe(getMe()), []);
  useEffect(() => {
    if (!tracker) return;
    tracker.onImpression = () => setSeen((n) => n + 1);
    return () => tracker.dispose();
  }, [tracker]);

  // Campaign list, refreshed so newly generated ads pop into the city live.
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/campaigns")
        .then((r) => r.json())
        .then((cs: Campaign[]) => alive && setCampaigns(cs))
        .catch(() => {});
    load();
    const id = setInterval(load, 8000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const goTo = useCallback(
    (id: string) => {
      const i = campaigns.findIndex((c) => c.id === id);
      if (i < 0 || !slots[i]) return;
      setTeleport({ ...viewpoint(slots[i]) });
    },
    [campaigns],
  );

  // Spawn in front of the focused billboard (coming from the generator).
  const focused = useRef(false);
  useEffect(() => {
    if (focused.current || !focusId || campaigns.length === 0) return;
    focused.current = true;
    goTo(focusId);
  }, [focusId, campaigns, goTo]);

  // Presence heartbeat through Valkey.
  useEffect(() => {
    if (!me) return;
    let alive = true;
    const beat = () =>
      fetch("/api/presence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...me, ...pose.current }),
      })
        .then((r) => r.json())
        .then((d) => alive && d.players && setPlayers(d.players))
        .catch(() => {});
    beat();
    const id = setInterval(beat, 700);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [me]);

  const select = useCallback(
    (c: Campaign, v: number) => {
      tracker?.click(c.id, v);
      setSelected({ c, v });
    },
    [tracker],
  );

  return (
    <div data-theme="dark" className="lime fixed inset-0 bg-page text-fg">
      {me && tracker && (
        <Canvas camera={{ fov: 60, near: 0.5, far: 400, position: [0, 6, 33] }} dpr={[1, 1.75]} gl={{ antialias: true }}>
          <Suspense fallback={null}>
            <Scene
              campaigns={campaigns}
              players={players}
              color={me.color}
              pose={pose}
              teleport={teleport}
              tracker={tracker}
              focusId={selected?.c.id ?? focusId}
              onSelect={select}
            />
          </Suspense>
        </Canvas>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
        <div className="pointer-events-auto flex h-(--control-md) items-center gap-4 rounded-control bg-surface px-4 shadow-menu">
          <Link href="/" className="text-sm font-semibold">
            AdCity
          </Link>
          <span className="text-sm text-fg-2">
            {players.length + 1} here, {campaigns.length} billboards, {seen} seen by you
          </span>
        </div>
        <div className="pointer-events-auto flex gap-2">
          <Link href="/dashboard" className={buttonVariants({ variant: "secondary" })}>
            Analytics
          </Link>
          <Link href="/" className={buttonVariants()}>
            Put your project here
          </Link>
        </div>
      </div>

      <div className="absolute start-4 top-20 bottom-4 hidden w-72 flex-col gap-2 md:flex">
        <Button variant="secondary" size="sm" className="self-start" onClick={() => setListOpen((o) => !o)}>
          {listOpen ? "Hide projects" : "Show projects"}
        </Button>
        {listOpen && (
          <div className="min-h-0 flex-1 overflow-y-auto rounded-panel bg-surface shadow-menu">
            {campaigns.length === 0 ? (
              <p className="p-4 text-sm text-fg-2">No billboards yet. Be the first.</p>
            ) : (
              <List>
                {campaigns.map((c) => (
                  <ListItem
                    key={c.id}
                    onClick={() => goTo(c.id)}
                    leading={<Avatar size="sm" name={c.name} src={imageUrl(c) ?? undefined} />}
                    title={c.name}
                    description={c.variants[0]?.headline}
                  />
                ))}
              </List>
            )}
          </div>
        )}
      </div>

      <Minimap campaigns={campaigns} pose={pose} players={players} />

      {selected && (
        <div className="absolute bottom-4 left-1/2 flex w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-3 rounded-sheet bg-surface p-3 shadow-overlay">
          <AdCard campaign={selected.c} variant={selected.v} />
          <p className="px-1 text-sm text-fg-2">{selected.c.description}</p>
          <div className="flex flex-wrap items-center gap-2 px-1 pb-1">
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
              Close
            </Button>
            <Link href={`/c/${selected.c.id}`} className={buttonVariants({ variant: "secondary", size: "sm", className: "ms-auto" })}>
              See its stats
            </Link>
            <a href={visitUrl(selected.c, selected.v, "world")} target="_blank" rel="noopener" className={buttonVariants({ size: "sm" })}>
              Open {selected.c.name}
            </a>
          </div>
        </div>
      )}

      {!selected && (
        <p className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-control bg-surface px-4 py-2 text-sm text-fg-2 shadow-menu max-md:hidden">
          Walk with WASD or the arrows, drag to look, click a billboard to open it
        </p>
      )}
    </div>
  );
}

function Minimap({ campaigns, pose, players }: { campaigns: Campaign[]; pose: React.RefObject<Pose>; players: Player[] }) {
  const dot = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const p = pose.current;
      if (dot.current) {
        dot.current.style.left = `${((p.x + LIMIT) / (2 * LIMIT)) * 100}%`;
        dot.current.style.top = `${((p.z + LIMIT) / (2 * LIMIT)) * 100}%`;
        dot.current.style.transform = `translate(-50%,-50%) rotate(${-p.ry}rad)`;
      }
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [pose]);
  const pos = (x: number, z: number) => ({
    left: `${((x + LIMIT) / (2 * LIMIT)) * 100}%`,
    top: `${((z + LIMIT) / (2 * LIMIT)) * 100}%`,
  });
  return (
    <div aria-hidden="true" className="absolute end-4 top-20 hidden size-44 overflow-hidden rounded-panel bg-surface shadow-menu md:block">
      {slots.slice(0, campaigns.length).map((s, i) => (
        <span
          key={s.index}
          className="absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-sm"
          style={{ ...pos(s.x, s.z), background: campaigns[i].palette.accent }}
        />
      ))}
      {players.map((p) => (
        <span key={p.id} className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ ...pos(p.x, p.z), background: p.color }} />
      ))}
      <div ref={dot} className="absolute">
        <svg width="12" height="12" viewBox="0 0 12 12" className="text-fg">
          <path d="M6 12 L0 0 L12 0 Z" fill="currentColor" />
        </svg>
      </div>
    </div>
  );
}
