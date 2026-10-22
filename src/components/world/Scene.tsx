"use client";

import { Suspense, forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Html, useCursor, useTexture } from "@react-three/drei";
import * as THREE from "three";
import type { Campaign, Player } from "@/lib/types";
import { imageUrl } from "@/lib/format";
import manifest from "../../../public/city/manifest.json";
import { BLOCK, HALF, LIMIT, ROAD, SPACING, blocks, collide, neighbours, nodes, props, slots, type Slot, type SpriteName } from "./city";
import { AD_H, AD_W, paintAd, paintPlaceholder } from "./paint";
import type { Tracker } from "./tracker";
import { findPath } from "./path";

// Isometric camera: 45 degrees around, 30 degrees above the ground.
export const PITCH = Math.PI / 6;
export const YAW = Math.PI / 4;
const CAM_DIST = 80;
export const CAM_OFFSET = new THREE.Vector3(
  Math.sin(YAW) * Math.cos(PITCH) * CAM_DIST,
  Math.sin(PITCH) * CAM_DIST,
  Math.cos(YAW) * Math.cos(PITCH) * CAM_DIST,
);
// Directions on the ground that read as screen up and screen right.
const SCREEN_UP = new THREE.Vector2(-1, -1).normalize();
const SCREEN_RIGHT = new THREE.Vector2(1, -1).normalize();

export const AVATARS = ["c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8"] as const;
export type Avatar = (typeof AVATARS)[number];

const sizes = manifest as Record<string, { w: number; h: number }>;
const url = (name: string) => `/city/${name}.webp`;
// Load every sprite up front: a texture that suspends mid-game (a walker turning
// around) would otherwise blank the scene while it loads.
if (typeof window !== "undefined") useTexture.preload(Object.keys(sizes).map(url));

// ---------- Standee: a cut-out sprite standing upright, turned to the camera ----------

type StandeeProps = { name: string; width: number; flip?: boolean; position?: [number, number, number] };

/**
 * Vertical plane anchored at its bottom centre. The camera looks down at 30 degrees, so the
 * plane is stretched by 1/cos(pitch) to show the art at its drawn proportions. alphaToCoverage
 * writes depth only where the art is, which gives correct overlap between sprites and 3D objects.
 */
const Standee = forwardRef<THREE.Group, StandeeProps>(function Standee(props, ref) {
  return (
    <Suspense fallback={null}>
      <StandeeArt {...props} ref={ref} />
    </Suspense>
  );
});

const StandeeArt = forwardRef<THREE.Group, StandeeProps>(function StandeeArt({ name, width, flip = false, position }, ref) {
  const tex = useTexture(url(name));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const s = sizes[name] ?? { w: 1, h: 1 };
  const height = (width * (s.h / s.w)) / Math.cos(PITCH);
  return (
    <group ref={ref} position={position} rotation-y={YAW}>
      <mesh position-y={height / 2} scale-x={flip ? -1 : 1}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={tex} alphaTest={0.5} alphaToCoverage side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
    </group>
  );
});

function BlobShadow({ radius, opacity = 0.18 }: { radius: number; opacity?: number }) {
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={0.03} scale={[1, 0.62, 1]} renderOrder={1}>
      <circleGeometry args={[radius, 24]} />
      <meshBasicMaterial color="#1f3a2a" transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
}

// ---------- Ground ----------

function Ground({ onPick }: { onPick: (p: THREE.Vector3) => void }) {
  // Press and hold to keep walking toward the pointer; re-aim at most every 150ms.
  const holding = useRef(false);
  const lastAim = useRef(0);
  useEffect(() => {
    const up = () => (holding.current = false);
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, []);
  const dashes = useMemo(() => {
    const out: { x: number; z: number; rot: boolean }[] = [];
    for (let k = -HALF; k <= HALF + 1; k++) {
      const p = (k - 0.5) * SPACING;
      for (let s = -LIMIT + 2; s < LIMIT; s += 4) {
        // Skip the dashes inside intersections.
        if (Math.abs(((s + LIMIT) % SPACING) - SPACING / 2) > ROAD / 2 + 2) continue;
        out.push({ x: p, z: s, rot: false });
        out.push({ x: s, z: p, rot: true });
      }
    }
    return out;
  }, []);
  return (
    <group
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        holding.current = true;
        lastAim.current = performance.now();
        onPick(e.point);
      }}
      onPointerMove={(e) => {
        if (!holding.current || performance.now() - lastAim.current < 150) return;
        lastAim.current = performance.now();
        onPick(e.point);
      }}
    >
      <mesh rotation-x={-Math.PI / 2} position-y={-0.05}>
        <planeGeometry args={[LIMIT * 6, LIMIT * 6]} />
        <meshLambertMaterial color="#a9dc7f" />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0}>
        <planeGeometry args={[LIMIT * 2, LIMIT * 2]} />
        <meshLambertMaterial color="#d3d8df" />
      </mesh>
      {dashes.map((d, i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} rotation-z={d.rot ? Math.PI / 2 : 0} position={[d.x, 0.02, d.z]}>
          <planeGeometry args={[0.35, 1.8]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}
      {blocks.map((b) =>
        b.plaza ? (
          <group key={`${b.x}:${b.z}`} position={[b.x, 0, b.z]}>
            <mesh position-y={0.12}>
              <boxGeometry args={[BLOCK + 2, 0.24, BLOCK + 2]} />
              <meshLambertMaterial color="#f3e7d2" />
            </mesh>
            <mesh rotation-x={-Math.PI / 2} position-y={0.25}>
              <ringGeometry args={[7.5, 8.2, 48]} />
              <meshBasicMaterial color="#e2d2b4" />
            </mesh>
          </group>
        ) : (
          <group key={`${b.x}:${b.z}`} position={[b.x, 0, b.z]}>
            <mesh position-y={0.12}>
              <boxGeometry args={[BLOCK, 0.24, BLOCK]} />
              <meshLambertMaterial color="#efe7d6" />
            </mesh>
            <mesh position-y={0.27}>
              <boxGeometry args={[BLOCK - 2.4, 0.08, BLOCK - 2.4]} />
              <meshLambertMaterial color="#9fd67a" />
            </mesh>
          </group>
        ),
      )}
    </group>
  );
}

function Props() {
  return (
    <>
      {props.map((p, i) => (
        <group key={i} position={[p.x, 0.25, p.z]}>
          <BlobShadow radius={p.width * 0.42} opacity={p.width > 8 ? 0.12 : 0.16} />
          <Standee name={p.sprite as SpriteName} width={p.width} />
        </group>
      ))}
    </>
  );
}

// ---------- Billboards ----------

function useImage(src: string | null) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!src) return;
    const i = new Image();
    i.onload = () => setImg(i);
    i.src = src;
  }, [src]);
  return img;
}

function useAdTexture(campaign: Campaign | null, variant: number, n: number) {
  const canvas = useMemo(() => Object.assign(document.createElement("canvas"), { width: AD_W, height: AD_H }), []);
  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, [canvas]);
  const img = useImage(campaign ? imageUrl(campaign) : null);
  useEffect(() => {
    const ctx = canvas.getContext("2d")!;
    if (campaign) paintAd(ctx, campaign, variant, img);
    else paintPlaceholder(ctx, n);
    texture.needsUpdate = true;
  }, [canvas, texture, campaign, variant, img, n]);
  return texture;
}

const ROTATE_MS = 9000;
function useVariant(campaign: Campaign | null, offset: number) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!campaign || campaign.variants.length < 2) return;
    const tick = () => setV(Math.floor((Date.now() + offset * 1700) / ROTATE_MS) % campaign.variants.length);
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [campaign, offset]);
  return v;
}

const BOARD_W = 7.5;
const BOARD_H = 5;
const POST = 3.2;

function Billboard({
  slot,
  campaign,
  tracker,
  onSelect,
  highlighted,
}: {
  slot: Slot;
  campaign: Campaign | null;
  tracker: Tracker;
  onSelect: (c: Campaign, variant: number) => void;
  highlighted: boolean;
}) {
  const variant = useVariant(campaign, slot.index);
  const texture = useAdTexture(campaign, variant, slot.index + 1);
  const [hover, setHover] = useState(false);
  useCursor(hover && !!campaign);
  const variantRef = useRef(variant);
  variantRef.current = variant;
  const board = useRef<THREE.Group>(null);

  useEffect(() => {
    if (!campaign) return;
    return tracker.register(campaign.id, slot, () => variantRef.current);
  }, [campaign, slot, tracker]);

  useFrame(({ clock }) => {
    if (!board.current) return;
    const lift = highlighted ? Math.abs(Math.sin(clock.elapsedTime * 3)) * 0.25 : hover ? 0.12 : 0;
    board.current.position.y += (POST + BOARD_H / 2 + lift - board.current.position.y) * 0.2;
  });

  const accent = campaign?.palette.accent ?? "#e4f222";
  return (
    <group position={[slot.x, 0.25, slot.z]} rotation-y={slot.ry}>
      <BlobShadow radius={3.4} opacity={0.12} />
      {[-BOARD_W / 2 + 1, BOARD_W / 2 - 1].map((x) => (
        <mesh key={x} position={[x, POST / 2, -0.15]}>
          <cylinderGeometry args={[0.14, 0.14, POST, 10]} />
          <meshLambertMaterial color="#5b6475" />
        </mesh>
      ))}
      <group ref={board} position-y={POST + BOARD_H / 2}>
        <mesh position-z={-0.2}>
          <boxGeometry args={[BOARD_W + 0.5, BOARD_H + 0.5, 0.3]} />
          <meshLambertMaterial color={highlighted || hover ? accent : "#ffffff"} />
        </mesh>
        <mesh
          position-z={-0.04}
          onClick={(e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation();
            if (campaign) onSelect(campaign, variant);
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHover(true);
          }}
          onPointerOut={() => setHover(false)}
        >
          <planeGeometry args={[BOARD_W, BOARD_H]} />
          <meshBasicMaterial map={texture} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

// ---------- Plaza screen: plays the video ads one after another ----------

type VideoAdRef = { campaign: Campaign; videoId: string; format: string };

function PlazaScreen({ onSelect }: { onSelect: (c: Campaign, v: number) => void }) {
  const [ads, setAds] = useState<VideoAdRef[]>([]);
  const [i, setI] = useState(0);
  const video = useMemo(() => {
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.crossOrigin = "anonymous";
    return v;
  }, []);
  const texture = useMemo(() => {
    const t = new THREE.VideoTexture(video);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [video]);

  useEffect(() => {
    fetch("/api/videos")
      .then((r) => r.json())
      .then((list: VideoAdRef[]) => setAds(list.filter((a) => a.format === "vertical")))
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!ads.length) return;
    video.src = `/api/videos/${ads[i % ads.length].videoId}/file`;
    video.play().catch(() => {});
    const next = () => setI((x) => x + 1);
    video.addEventListener("ended", next);
    return () => video.removeEventListener("ended", next);
  }, [ads, i, video]);
  useEffect(() => () => video.pause(), [video]);

  // Show the clip only once it has a frame; until then the screen shows the ad poster.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(false);
    const on = () => setReady(true);
    video.addEventListener("loadeddata", on);
    return () => video.removeEventListener("loadeddata", on);
  }, [video, i]);
  const W = 5.4;
  const H = 9.6;
  const current = ads.length ? ads[i % ads.length] : null;
  const poster = useAdTexture(current?.campaign ?? null, 0, 0);
  return (
    <group position={[-1.5, 0.25, -1.5]} rotation-y={YAW}>
      <mesh position-y={2.5}>
        <boxGeometry args={[1.2, 5, 1.2]} />
        <meshLambertMaterial color="#5b6475" />
      </mesh>
      <mesh position-y={5 + H / 2}>
        <boxGeometry args={[W + 0.6, H + 0.6, 0.6]} />
        <meshLambertMaterial color="#2a2f3a" />
      </mesh>
      <mesh
        position={[0, 5 + H / 2, 0.31]}
        onClick={(e) => {
          e.stopPropagation();
          if (current) onSelect(current.campaign, 0);
        }}
      >
        <planeGeometry args={[W, H]} />
        <meshBasicMaterial map={ready ? texture : poster} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ---------- Characters ----------

type Facing = { front: boolean; flip: boolean };

/** Which of the two drawn views to show, and mirrored or not, for a ground direction. */
function facingFor(dx: number, dz: number, prev: Facing): Facing {
  if (Math.abs(dx) + Math.abs(dz) < 1e-4) return prev;
  const up = dx * SCREEN_UP.x + dz * SCREEN_UP.y;
  const right = dx * SCREEN_RIGHT.x + dz * SCREEN_RIGHT.y;
  const front = up < 0;
  // The front view walks toward the bottom left, the back view toward the top right.
  return { front, flip: front ? right > 0 : right < 0 };
}

function Character({
  avatar,
  pos,
  label,
}: {
  avatar: string;
  pos: React.RefObject<{ x: number; z: number; dx: number; dz: number }>;
  /** Kept for callers; the walk cycle now follows the distance actually covered. */
  moving?: React.RefObject<boolean>;
  label?: React.ReactNode;
}) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const [facing, setFacing] = useState<Facing>({ front: true, flip: false });
  const anim = useRef({
    facing: { front: true, flip: false } as Facing,
    pending: null as Facing | null,
    pendingFor: 0,
    stride: Math.random() * 10,
    amount: 0,
    lx: NaN,
    lz: NaN,
  });

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const p = pos.current;
    const a = anim.current;
    if (!root.current || !body.current) return;
    root.current.position.set(p.x, 0.25, p.z);
    const step = Number.isNaN(a.lx) ? 0 : Math.hypot(p.x - a.lx, p.z - a.lz);
    a.lx = p.x;
    a.lz = p.z;
    // amount eases between standing (0) and walking (1) so starts and stops do not pop.
    const walking = step > 0.002;
    a.amount += ((walking ? 1 : 0) - a.amount) * (1 - Math.exp(-dt * 10));
    a.stride += step / 0.55;
    const swing = Math.sin(a.stride * Math.PI);
    body.current.position.y = Math.abs(swing) * 0.22 * a.amount;
    body.current.rotation.z = swing * 0.045 * a.amount;
    const breathe = Math.sin(clock.elapsedTime * 2.2 + a.stride) * 0.012 * (1 - a.amount);
    body.current.scale.set(1, 1 + breathe - Math.abs(Math.cos(a.stride * Math.PI)) * 0.025 * a.amount, 1);
    // Only turn once the new direction has held for a moment, so the sprite does not flicker.
    if (walking) {
      const f = facingFor(p.dx, p.dz, a.facing);
      if (f.front !== a.facing.front || f.flip !== a.facing.flip) {
        if (a.pending && a.pending.front === f.front && a.pending.flip === f.flip) a.pendingFor += dt;
        else {
          a.pending = f;
          a.pendingFor = 0;
        }
        if (a.pendingFor > 0.09) {
          a.facing = f;
          a.pending = null;
          setFacing(f);
        }
      } else a.pending = null;
    }
  });

  return (
    <group ref={root}>
      <BlobShadow radius={0.85} opacity={0.22} />
      <group ref={body}>
        <Standee name={`${avatar}-${facing.front ? "front" : "back"}`} width={1.9} flip={facing.flip} />
      </group>
      {label && (
        <Html position={[0, 4.4, 0]} center zIndexRange={[10, 0]}>
          {label}
        </Html>
      )}
    </group>
  );
}

function NameTag({ name, color }: { name: string; color: string }) {
  return (
    <div className="pointer-events-none flex items-center gap-1.5 rounded-control bg-raised px-2.5 py-1 text-xs font-medium whitespace-nowrap text-fg shadow-menu">
      <span className="inline-block size-2 rounded-full" style={{ background: color }} />
      {name}
    </div>
  );
}

/** Ambient passers-by walking the sidewalks from corner to corner. */
function Walker({ seed }: { seed: number }) {
  const r = useMemo(() => {
    let s = seed * 9301 + 49297;
    return () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  }, [seed]);
  const avatar = AVATARS[seed % AVATARS.length];
  const side = useMemo(() => (r() > 0.5 ? 1 : -1) * (ROAD / 2 - 1.2), [r]);
  const state = useRef({ from: nodes[Math.floor(r() * nodes.length)], to: nodes[0], t: 0, wait: r() * 3 });
  const pos = useRef({ x: 0, z: 0, dx: 0, dz: 0 });
  const moving = useRef(false);
  useMemo(() => {
    const n = neighbours(state.current.from);
    state.current.to = n[Math.floor(r() * n.length)];
  }, [r]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const s = state.current;
    if (s.wait > 0) {
      s.wait -= dt;
      moving.current = false;
    } else {
      const len = Math.hypot(s.to.x - s.from.x, s.to.z - s.from.z);
      s.t += (dt * 2.6) / len;
      moving.current = true;
      if (s.t >= 1) {
        const n = neighbours(s.to).filter((m) => m !== s.from);
        s.from = s.to;
        s.to = n[Math.floor(r() * n.length)] ?? s.from;
        s.t = 0;
        if (r() < 0.3) s.wait = 1 + r() * 3;
      }
    }
    const dx = s.to.x - s.from.x;
    const dz = s.to.z - s.from.z;
    const len = Math.hypot(dx, dz) || 1;
    // Keep to one side of the road, like a sidewalk.
    const ox = (-dz / len) * side;
    const oz = (dx / len) * side;
    pos.current = { x: s.from.x + dx * s.t + ox, z: s.from.z + dz * s.t + oz, dx, dz };
  });

  return <Character avatar={avatar} pos={pos} moving={moving} />;
}

function Ghost({ p }: { p: Player }) {
  const pos = useRef({ x: p.x, z: p.z, dx: 0, dz: 0 });
  const moving = useRef(false);
  const target = useRef(p);
  target.current = p;
  useFrame((_, dt) => {
    const k = 1 - Math.exp(-dt * 6);
    const c = pos.current;
    const dx = target.current.x - c.x;
    const dz = target.current.z - c.z;
    moving.current = Math.hypot(dx, dz) > 0.05;
    pos.current = { x: c.x + dx * k, z: c.z + dz * k, dx, dz };
  });
  return <Character avatar={p.avatar ?? "c1"} pos={pos} moving={moving} label={<NameTag name={p.name} color={p.color} />} />;
}

// ---------- The player and the camera ----------

export type Pose = { x: number; z: number; ry: number };

function Me({
  avatar,
  pose,
  target,
  tracker,
  teleport,
}: {
  avatar: string;
  pose: React.RefObject<Pose>;
  target: React.RefObject<THREE.Vector3 | null>;
  tracker: Tracker;
  teleport: Pose | null;
}) {
  const keys = useRef(new Set<string>());
  const { camera, gl } = useThree();
  const pos = useRef({ x: pose.current.x, z: pose.current.z, dx: 1, dz: 1 });
  const vel = useRef(new THREE.Vector2());
  const path = useRef<{ x: number; z: number }[]>([]);
  const aimed = useRef<THREE.Vector3 | null>(null);
  const look = useRef(new THREE.Vector3(pose.current.x, 0, pose.current.z));
  const zoom = useRef((camera as THREE.OrthographicCamera).zoom);

  useEffect(() => {
    if (!teleport) return;
    pose.current = { ...teleport };
    pos.current = { ...pos.current, x: teleport.x, z: teleport.z };
    look.current.set(teleport.x, 0, teleport.z);
    vel.current.set(0, 0);
    path.current = [];
    target.current = null;
  }, [teleport, pose, target]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input, textarea")) return;
      keys.current.add(e.key.toLowerCase());
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    const blur = () => keys.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  // Wheel and pinch zoom ease toward the requested level.
  useEffect(() => {
    const el = gl.domElement;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      zoom.current = THREE.MathUtils.clamp(zoom.current * Math.exp(-e.deltaY * 0.0015), 10, 42);
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [gl]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const k = keys.current;
    const p = pose.current;
    const run = k.has("shift");
    const maxSpeed = run ? 14 : 8;

    // A new click target becomes a path around the solids.
    if (target.current !== aimed.current) {
      aimed.current = target.current;
      path.current = target.current ? findPath(p.x, p.z, target.current.x, target.current.z) : [];
    }

    const sy = (k.has("w") || k.has("z") || k.has("arrowup") ? 1 : 0) - (k.has("s") || k.has("arrowdown") ? 1 : 0);
    const sx = (k.has("d") || k.has("arrowright") ? 1 : 0) - (k.has("a") || k.has("q") || k.has("arrowleft") ? 1 : 0);
    const want = new THREE.Vector2();
    if (sx || sy) {
      want.set(SCREEN_UP.x * sy + SCREEN_RIGHT.x * sx, SCREEN_UP.y * sy + SCREEN_RIGHT.y * sx).normalize().multiplyScalar(maxSpeed);
      path.current = [];
      target.current = null;
      aimed.current = null;
    } else if (path.current.length) {
      const next = path.current[0];
      const dx = next.x - p.x;
      const dz = next.z - p.z;
      const d = Math.hypot(dx, dz);
      const last = path.current.length === 1;
      if (d < (last ? 0.15 : 0.6)) {
        path.current.shift();
        if (!path.current.length) {
          target.current = null;
          aimed.current = null;
        }
      } else {
        // Slow down over the last couple of units instead of stopping dead.
        const speed = last ? Math.min(maxSpeed, d * 4 + 1) : maxSpeed;
        want.set(dx / d, dz / d).multiplyScalar(speed);
      }
    }
    // Ease the velocity toward what is wanted: quick to start, a touch softer to stop.
    const rate = want.lengthSq() > 0 ? 14 : 18;
    vel.current.lerp(want, 1 - Math.exp(-dt * rate));
    if (vel.current.lengthSq() < 0.0004) vel.current.set(0, 0);

    if (vel.current.lengthSq() > 0) {
      const [nx, nz] = collide(p.x + vel.current.x * dt, p.z + vel.current.y * dt);
      // Bleed off the part of the velocity a wall absorbed, so the walker slides along it.
      if (dt > 0) vel.current.set((nx - p.x) / dt, (nz - p.z) / dt);
      p.x = nx;
      p.z = nz;
      p.ry = Math.atan2(vel.current.x, vel.current.y);
      pos.current = { x: p.x, z: p.z, dx: vel.current.x, dz: vel.current.y };
    } else pos.current = { ...pos.current, x: p.x, z: p.z };

    // Camera: critically damped follow with a little look-ahead in the walking direction.
    const ahead = new THREE.Vector3(p.x + vel.current.x * 0.25, 0, p.z + vel.current.y * 0.25);
    look.current.lerp(ahead, 1 - Math.exp(-dt * 4));
    camera.position.copy(look.current).add(CAM_OFFSET);
    camera.lookAt(look.current);
    const cam = camera as THREE.OrthographicCamera;
    if (Math.abs(cam.zoom - zoom.current) > 0.01) {
      cam.zoom += (zoom.current - cam.zoom) * (1 - Math.exp(-dt * 10));
      cam.updateProjectionMatrix();
    }
    tracker.tick(camera, look.current);
  });

  return <Character avatar={avatar} pos={pos} />;
}

// ---------- Root ----------

export function Scene({
  campaigns,
  players,
  avatar,
  pose,
  teleport,
  tracker,
  focusId,
  onSelect,
}: {
  campaigns: Campaign[];
  players: Player[];
  avatar: string;
  pose: React.RefObject<Pose>;
  teleport: Pose | null;
  tracker: Tracker;
  focusId: string | null;
  onSelect: (c: Campaign, variant: number) => void;
}) {
  const target = useRef<THREE.Vector3 | null>(null);
  const marker = useRef<THREE.Mesh>(null);
  const shown = Math.min(slots.length, Math.max(campaigns.length + 3, 10));
  useFrame(({ clock }) => {
    if (!marker.current) return;
    marker.current.visible = !!target.current;
    if (target.current) {
      marker.current.position.set(target.current.x, 0.3, target.current.z);
      marker.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 6) * 0.08);
    }
  });

  return (
    <>
      <hemisphereLight args={["#ffffff", "#b8d99a", 1.6]} />
      <directionalLight position={[-30, 60, 20]} intensity={1.4} color="#fff6e5" />
      <Ground
        onPick={(p) => {
          const [x, z] = collide(p.x, p.z);
          target.current = new THREE.Vector3(x, 0, z);
        }}
      />
      <Props />
      <PlazaScreen onSelect={onSelect} />
      {slots.slice(0, shown).map((s, i) => (
        <Billboard
          key={s.index}
          slot={s}
          campaign={campaigns[i] ?? null}
          tracker={tracker}
          onSelect={onSelect}
          highlighted={!!campaigns[i] && campaigns[i].id === focusId}
        />
      ))}
      {Array.from({ length: 14 }, (_, i) => (
        <Walker key={i} seed={i + 1} />
      ))}
      {players.map((p) => (
        <Ghost key={p.id} p={p} />
      ))}
      <mesh ref={marker} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.5, 0.75, 32]} />
        <meshBasicMaterial color="#7c8700" />
      </mesh>
      <Me avatar={avatar} pose={pose} target={target} tracker={tracker} teleport={teleport} />
    </>
  );
}
