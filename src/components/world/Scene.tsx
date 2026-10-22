"use client";

import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Html, useCursor, useTexture } from "@react-three/drei";
import * as THREE from "three";
import type { Campaign, Player } from "@/lib/types";
import { imageUrl } from "@/lib/format";
import manifest from "../../../public/city/manifest.json";
import { BLOCK, HALF, LIMIT, ROAD, SPACING, blocks, collide, neighbours, nodes, props, slots, type Slot, type SpriteName } from "./city";
import { AD_H, AD_W, paintAd, paintPlaceholder } from "./paint";
import type { Tracker } from "./tracker";

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

// ---------- Standee: a cut-out sprite standing upright, turned to the camera ----------

type StandeeProps = { name: string; width: number; flip?: boolean; position?: [number, number, number] };

/**
 * Vertical plane anchored at its bottom centre. The camera looks down at 30 degrees, so the
 * plane is stretched by 1/cos(pitch) to show the art at its drawn proportions. alphaToCoverage
 * writes depth only where the art is, which gives correct overlap between sprites and 3D objects.
 */
const Standee = forwardRef<THREE.Group, StandeeProps>(function Standee({ name, width, flip = false, position }, ref) {
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
      onClick={(e) => {
        if (e.delta > 6) return;
        e.stopPropagation();
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

  const W = 5.4;
  const H = 9.6;
  const current = ads.length ? ads[i % ads.length] : null;
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
        {ads.length ? <meshBasicMaterial map={texture} toneMapped={false} /> : <meshBasicMaterial color="#11141b" />}
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
  moving,
  label,
}: {
  avatar: string;
  pos: React.RefObject<{ x: number; z: number; dx: number; dz: number }>;
  moving: React.RefObject<boolean>;
  label?: React.ReactNode;
}) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const [facing, setFacing] = useState<Facing>({ front: true, flip: false });
  const facingRef = useRef(facing);
  const phase = useMemo(() => Math.random() * 10, []);

  useFrame(({ clock }) => {
    const p = pos.current;
    if (!root.current || !body.current) return;
    root.current.position.set(p.x, 0.25, p.z);
    const t = clock.elapsedTime * 9 + phase;
    if (moving.current) {
      body.current.position.y = Math.abs(Math.sin(t)) * 0.28;
      body.current.rotation.z = Math.sin(t) * 0.05;
      body.current.scale.set(1, 1 - Math.abs(Math.cos(t)) * 0.03, 1);
      const f = facingFor(p.dx, p.dz, facingRef.current);
      if (f.front !== facingRef.current.front || f.flip !== facingRef.current.flip) {
        facingRef.current = f;
        setFacing(f);
      }
    } else {
      body.current.position.y = 0;
      body.current.rotation.z = 0;
      body.current.scale.set(1, 1 + Math.sin(clock.elapsedTime * 2 + phase) * 0.012, 1);
    }
  });

  return (
    <group ref={root}>
      <BlobShadow radius={0.85} opacity={0.22} />
      <group ref={body}>
        <Standee name={`${avatar}-${facing.front ? "front" : "back"}`} width={1.9} flip={facing.flip} />
      </group>
      {label && (
        <Html position={[0, 4.4, 0]} center distanceFactor={undefined} zIndexRange={[10, 0]}>
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
  const moving = useRef(false);
  const look = useRef(new THREE.Vector3(pose.current.x, 0, pose.current.z));

  useEffect(() => {
    if (!teleport) return;
    pose.current = { ...teleport };
    pos.current = { ...pos.current, x: teleport.x, z: teleport.z };
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

  // Wheel zoom on the orthographic camera.
  useEffect(() => {
    const el = gl.domElement;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const cam = camera as THREE.OrthographicCamera;
      cam.zoom = THREE.MathUtils.clamp(cam.zoom * (e.deltaY > 0 ? 0.9 : 1.1), 9, 40);
      cam.updateProjectionMatrix();
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [camera, gl]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const k = keys.current;
    const p = pose.current;
    const upKey = k.has("w") || k.has("z") || k.has("arrowup") ? 1 : 0;
    const downKey = k.has("s") || k.has("arrowdown") ? 1 : 0;
    const leftKey = k.has("a") || k.has("q") || k.has("arrowleft") ? 1 : 0;
    const rightKey = k.has("d") || k.has("arrowright") ? 1 : 0;
    const sy = upKey - downKey;
    const sx = rightKey - leftKey;
    const speed = (k.has("shift") ? 16 : 9) * dt;
    let mx = (SCREEN_UP.x * sy + SCREEN_RIGHT.x * sx) * speed;
    let mz = (SCREEN_UP.y * sy + SCREEN_RIGHT.y * sx) * speed;
    if (sx && sy) {
      mx *= Math.SQRT1_2;
      mz *= Math.SQRT1_2;
    }
    if (sx || sy) target.current = null;
    else if (target.current) {
      const dx = target.current.x - p.x;
      const dz = target.current.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.3) target.current = null;
      else {
        const s = Math.min(d, 10 * dt);
        mx = (dx / d) * s;
        mz = (dz / d) * s;
      }
    }
    moving.current = !!(mx || mz);
    if (moving.current) {
      [p.x, p.z] = collide(p.x + mx, p.z + mz);
      p.ry = Math.atan2(mx, mz);
      pos.current = { x: p.x, z: p.z, dx: mx, dz: mz };
    }
    look.current.lerp(new THREE.Vector3(p.x, 0, p.z), 1 - Math.exp(-dt * 5));
    camera.position.copy(look.current).add(CAM_OFFSET);
    camera.lookAt(look.current);
    tracker.tick(camera, look.current);
  });

  return <Character avatar={avatar} pos={pos} moving={moving} />;
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
