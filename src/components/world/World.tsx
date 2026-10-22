"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import Link from "next/link";
import type { Campaign, Player } from "@/lib/types";
import { me as getMe, saveMe, visitUrl, type Me } from "@/lib/client";
import { AdCard } from "@/components/AdCard";
import { Avatar } from "@/components/lime/ui/avatar";
import { Button, buttonVariants } from "@/components/lime/ui/button";
import { List, ListItem } from "@/components/lime/ui/list";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/lime/ui/dialog";
import { Field, FieldLabel } from "@/components/lime/ui/field";
import { Input } from "@/components/lime/ui/input";
import { imageUrl } from "@/lib/format";
import { LIMIT, slots, viewpoint } from "./city";
import { AVATARS, CAM_OFFSET, Scene, type Pose } from "./Scene";
import { Tracker } from "./tracker";

const SPAWN: Pose = { x: 9, z: 11, ry: 0 };

export default function World({ focusId }: { focusId: string | null }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [selected, setSelected] = useState<{ c: Campaign; v: number } | null>(null);
  const [teleport, setTeleport] = useState<Pose | null>(null);
  const [seen, setSeen] = useState(0);
  const [listOpen, setListOpen] = useState(false);
  const pose = useRef<Pose>({ ...SPAWN });
  const tracker = useMemo(() => (me ? new Tracker(me.id) : null), [me]);

  useEffect(() => {
    const m = getMe();
    // ?avatar=c3 skips the picker (handy for shared links and screenshots).
    const pick = new URLSearchParams(location.search).get("avatar");
    if (!m.avatar && pick && (AVATARS as readonly string[]).includes(pick)) {
      m.avatar = pick;
      saveMe(m);
    }
    setMe(m);
  }, []);
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
    // Daytime sky behind the transparent canvas.
    <div className="fixed inset-0 bg-[linear-gradient(#bfe6ff,#e9f7ff)] text-fg">
      {me?.avatar && tracker && (
        <Canvas
          orthographic
          camera={{ zoom: 20, near: 1, far: 400, position: [SPAWN.x + CAM_OFFSET.x, CAM_OFFSET.y, SPAWN.z + CAM_OFFSET.z] }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true }}
        >
          <Suspense fallback={null}>
            <Scene
              campaigns={campaigns}
              players={players}
              avatar={me.avatar}
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
          Walk with WASD or click the ground, scroll to zoom, click a billboard to open it
        </p>
      )}

      <AvatarPicker me={me} onDone={(m) => setMe(m)} />
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

/** First visit: pick a character and a name. Stored locally with the session id. */
function AvatarPicker({ me, onDone }: { me: Me | null; onDone: (m: Me) => void }) {
  const open = !!me && !me.avatar;
  const [avatar, setAvatar] = useState<string>(AVATARS[0]);
  const [name, setName] = useState("");
  useEffect(() => {
    if (me) setName(me.name);
  }, [me]);
  if (!me) return null;
  const done = () => {
    const m = { ...me, avatar, name: name.trim().slice(0, 24) || me.name };
    saveMe(m);
    onDone(m);
  };
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent showClose={false}>
        <DialogHeader>
          <DialogTitle>Pick your character</DialogTitle>
          <DialogDescription>Other people in the city see this character and your name above it.</DialogDescription>
        </DialogHeader>
        <div role="radiogroup" aria-label="Character" className="grid grid-cols-4 gap-2">
          {AVATARS.map((a) => (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={avatar === a}
              aria-label={`Character ${a.slice(1)}`}
              onClick={() => setAvatar(a)}
              className={`flex aspect-square items-end justify-center overflow-hidden rounded-field p-1 ${avatar === a ? "bg-accent-wash outline-2 outline-accent-line" : "bg-surface hover:bg-surface-2"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/city/${a}-front.webp`} alt="" className="h-full w-auto object-contain" />
            </button>
          ))}
        </div>
        <Field name="name">
          <FieldLabel>Your name</FieldLabel>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} />
        </Field>
        <DialogFooter>
          <Button size="lg" className="w-full sm:w-auto" onClick={done}>
            Enter the city
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
