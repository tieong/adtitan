"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import Link from "next/link";
import type { Campaign, Player } from "@/lib/types";
import { me as getMe, visitUrl, type Me } from "@/lib/client";
import { AdCard } from "@/components/AdCard";
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
    <div className="fixed inset-0 bg-[#04050a] text-white">
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

      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4">
        <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-white/10 bg-black/60 px-4 py-2.5 backdrop-blur-md">
          <Link href="/" className="font-semibold tracking-tight">
            Ad<span className="text-[#7cf7ff]">City</span>
          </Link>
          <span className="h-4 w-px bg-white/15" />
          <span className="flex items-center gap-1.5 font-mono text-xs text-white/70">
            <span className="size-1.5 animate-pulse rounded-full bg-[#8cff7a]" />
            {players.length + 1} online
          </span>
          <span className="font-mono text-xs text-white/50">{campaigns.length} billboards</span>
          <span className="font-mono text-xs text-white/50">{seen} ads seen</span>
        </div>
        <div className="pointer-events-auto flex gap-2">
          <Link
            href="/dashboard"
            className="rounded-xl border border-white/10 bg-black/60 px-3.5 py-2 text-sm text-white/80 backdrop-blur-md hover:text-white"
          >
            Analytics
          </Link>
          <Link href="/" className="rounded-xl bg-[#7cf7ff] px-3.5 py-2 text-sm font-semibold text-black hover:bg-white">
            + Put your project here
          </Link>
        </div>
      </div>

      {/* Directory */}
      <div className="absolute bottom-4 left-4 top-20 hidden w-72 flex-col md:flex">
        <button
          onClick={() => setListOpen((o) => !o)}
          className="mb-2 self-start rounded-lg border border-white/10 bg-black/60 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-white/60 backdrop-blur-md"
        >
          {listOpen ? "Hide" : "Show"} projects
        </button>
        {listOpen && (
          <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-white/10 bg-black/55 p-2 backdrop-blur-md">
            {campaigns.length === 0 && <p className="p-3 text-sm text-white/50">No billboards yet. Be the first.</p>}
            {campaigns.map((c, i) => (
              <button
                key={c.id}
                onClick={() => goTo(c.id)}
                className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-white/5"
              >
                <span
                  className="grid size-9 shrink-0 place-items-center rounded-lg text-lg"
                  style={{ background: c.palette.bg, boxShadow: `inset 0 0 0 1px ${c.palette.accent}55` }}
                >
                  {c.emoji}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{c.name}</span>
                  <span className="block truncate text-xs text-white/45">{c.variants[0]?.headline}</span>
                </span>
                <span className="ml-auto font-mono text-[10px] text-white/30">#{i + 1}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <Minimap campaigns={campaigns} pose={pose} players={players} />

      {/* Selected ad */}
      {selected && (
        <div className="absolute bottom-4 left-1/2 w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 rounded-3xl border border-white/10 bg-black/75 p-3 backdrop-blur-xl">
          <AdCard campaign={selected.c} variant={selected.v} />
          <div className="flex items-center gap-2 p-2 pt-3">
            <p className="mr-auto line-clamp-2 text-sm text-white/65">{selected.c.description}</p>
            <button onClick={() => setSelected(null)} className="rounded-xl px-3 py-2 text-sm text-white/60 hover:text-white">
              Close
            </button>
            <Link
              href={`/c/${selected.c.id}`}
              className="rounded-xl border border-white/15 px-3 py-2 text-sm text-white/85 hover:bg-white/5"
            >
              Stats
            </Link>
            <a
              href={visitUrl(selected.c, selected.v, "world")}
              target="_blank"
              rel="noopener"
              className="whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold text-black"
              style={{ background: selected.c.palette.accent }}
            >
              {selected.c.variants[selected.v]?.cta ?? "Visit"} ↗
            </a>
          </div>
        </div>
      )}

      {!selected && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-black/60 px-4 py-2 font-mono text-[11px] text-white/60 backdrop-blur-md">
          WASD / arrows to walk · drag to look · click the ground to move · click a billboard
        </div>
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
    <div className="absolute right-4 top-20 hidden size-44 overflow-hidden rounded-2xl border border-white/10 bg-black/60 backdrop-blur-md md:block">
      {slots.slice(0, campaigns.length).map((s, i) => (
        <span
          key={s.index}
          className="absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-sm"
          style={{ ...pos(s.x, s.z), background: campaigns[i].palette.accent }}
        />
      ))}
      {players.map((p) => (
        <span
          key={p.id}
          className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ ...pos(p.x, p.z), background: p.color }}
        />
      ))}
      <div ref={dot} className="absolute">
        <div className="h-0 w-0 border-x-[5px] border-b-[10px] border-x-transparent border-b-white" style={{ transform: "rotate(180deg)" }} />
      </div>
    </div>
  );
}
