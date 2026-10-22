"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Html, Stars, useCursor } from "@react-three/drei";
import * as THREE from "three";
import type { Campaign, Player } from "@/lib/types";
import { imageUrl } from "@/lib/format";
import { BLOCK, LIMIT, SPACING, blocks, buildings, collide, slots, type Slot } from "./city";
import { AD_H, AD_W, paintAd, paintPlaceholder } from "./paint";
import type { Tracker } from "./tracker";

export const BOARD_W = 15;
export const BOARD_H = 10;
const ROTATE_MS = 9000;

// ---------- Ground, streets, buildings ----------

function windowTexture() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#05060a";
  ctx.fillRect(0, 0, 64, 128);
  for (let y = 4; y < 128; y += 8) {
    for (let x = 4; x < 64; x += 8) {
      const r = Math.random();
      ctx.fillStyle = r > 0.72 ? (r > 0.93 ? "#7cf7ff" : "#ffd9a0") : "#0b0d14";
      ctx.globalAlpha = r > 0.72 ? 0.35 + Math.random() * 0.65 : 1;
      ctx.fillRect(x, y, 4, 5);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  return t;
}

function Buildings() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const tex = useMemo(() => windowTexture(), []);
  useEffect(() => {
    const m = new THREE.Matrix4();
    const col = new THREE.Color();
    buildings.forEach((b, i) => {
      m.compose(
        new THREE.Vector3(b.x, b.h / 2, b.z),
        new THREE.Quaternion(),
        new THREE.Vector3(b.w, b.h, b.d),
      );
      ref.current!.setMatrixAt(i, m);
      col.setHSL(0.62 + b.tint * 0.12, 0.25, 0.09 + b.tint * 0.05);
      ref.current!.setColorAt(i, col);
    });
    ref.current!.instanceMatrix.needsUpdate = true;
    if (ref.current!.instanceColor) ref.current!.instanceColor.needsUpdate = true;
  }, []);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, buildings.length]} castShadow={false}>
      <boxGeometry />
      <meshStandardMaterial
        map={tex}
        emissiveMap={tex}
        emissive="#ffffff"
        emissiveIntensity={0.9}
        roughness={0.85}
        metalness={0.2}
      />
    </instancedMesh>
  );
}

function Ground() {
  const lines = useMemo(() => {
    const out: { x: number; z: number; w: number; d: number }[] = [];
    const span = LIMIT * 2;
    for (let i = -2; i <= 1; i++) {
      const p = (i + 0.5) * SPACING;
      for (let s = -LIMIT; s < LIMIT; s += 6) {
        out.push({ x: p, z: s, w: 0.25, d: 2.6 });
        out.push({ x: s, z: p, w: 2.6, d: 0.25 });
      }
    }
    return { out, span };
  }, []);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.01}>
        <planeGeometry args={[LIMIT * 2 + 200, LIMIT * 2 + 200]} />
        <meshStandardMaterial color="#090a10" roughness={0.6} metalness={0.4} />
      </mesh>
      {blocks.map((b) =>
        b.plaza ? (
          <mesh key={`${b.x}:${b.z}`} rotation-x={-Math.PI / 2} position={[b.x, 0.02, b.z]}>
            <circleGeometry args={[BLOCK / 2 + 3, 64]} />
            <meshStandardMaterial color="#10131c" roughness={0.3} metalness={0.6} />
          </mesh>
        ) : (
          <mesh key={`${b.x}:${b.z}`} position={[b.x, 0.15, b.z]}>
            <boxGeometry args={[BLOCK, 0.3, BLOCK]} />
            <meshStandardMaterial color="#14161f" roughness={0.9} />
          </mesh>
        ),
      )}
      {lines.out.map((l, i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[l.x, 0.01, l.z]}>
          <planeGeometry args={[l.w, l.d]} />
          <meshBasicMaterial color="#2a2f44" />
        </mesh>
      ))}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, 0]}>
        <ringGeometry args={[BLOCK / 2 + 2.6, BLOCK / 2 + 3, 96]} />
        <meshBasicMaterial color="#7cf7ff" toneMapped={false} />
      </mesh>
    </group>
  );
}

// ---------- Billboards ----------

function useImage(url: string | null) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!url) return;
    const i = new Image();
    i.onload = () => setImg(i);
    i.src = url;
  }, [url]);
  return img;
}

function useAdTexture(campaign: Campaign | null, variant: number, placeholderN: number) {
  const canvas = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = AD_W;
    c.height = AD_H;
    return c;
  }, []);
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
    else paintPlaceholder(ctx, placeholderN);
    texture.needsUpdate = true;
  }, [canvas, texture, campaign, variant, img, placeholderN]);
  return texture;
}

function useVariant(campaign: Campaign | null, offset: number) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!campaign || campaign.variants.length < 2) return;
    const n = campaign.variants.length;
    const tick = () => setV(Math.floor((Date.now() + offset * 1700) / ROTATE_MS) % n);
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [campaign, offset]);
  return v;
}

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
  const frame = useRef<THREE.MeshBasicMaterial>(null);
  const accent = campaign?.palette.accent ?? "#7cf7ff";
  const variantRef = useRef(variant);
  variantRef.current = variant;

  useEffect(() => {
    if (!campaign) return;
    return tracker.register(campaign.id, slot, () => variantRef.current);
  }, [campaign, slot, tracker]);

  useFrame(({ clock }) => {
    if (!frame.current) return;
    const pulse = highlighted ? 0.6 + Math.sin(clock.elapsedTime * 5) * 0.4 : hover ? 1 : 0.55;
    frame.current.opacity = pulse;
  });

  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (campaign) onSelect(campaign, variant);
  };

  const lift = 5.5;
  return (
    <group position={[slot.x, 0, slot.z]} rotation-y={slot.ry}>
      {[-BOARD_W / 2 + 1.2, BOARD_W / 2 - 1.2].map((x) => (
        <mesh key={x} position={[x, lift / 2, -0.25]}>
          <boxGeometry args={[0.35, lift, 0.35]} />
          <meshStandardMaterial color="#1b1e2b" metalness={0.8} roughness={0.3} />
        </mesh>
      ))}
      <mesh position={[0, lift + BOARD_H / 2, -0.35]}>
        <boxGeometry args={[BOARD_W + 0.8, BOARD_H + 0.8, 0.4]} />
        <meshStandardMaterial color="#0d0f17" metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh position={[0, lift + BOARD_H / 2, -0.13]}>
        <planeGeometry args={[BOARD_W + 0.5, BOARD_H + 0.5]} />
        <meshBasicMaterial ref={frame} color={accent} transparent toneMapped={false} />
      </mesh>
      <mesh
        position={[0, lift + BOARD_H / 2, -0.1]}
        onClick={click}
        onPointerOver={(e) => (e.stopPropagation(), setHover(true))}
        onPointerOut={() => setHover(false)}
      >
        <planeGeometry args={[BOARD_W, BOARD_H]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      <pointLight position={[0, lift + BOARD_H / 2, 4]} color={accent} intensity={25} distance={16} decay={2} />
    </group>
  );
}

/** Four-sided screen tower in the plaza cycling through every campaign. */
function Tower({ campaigns, onSelect }: { campaigns: Campaign[]; onSelect: (c: Campaign, v: number) => void }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (campaigns.length < 2) return;
    const id = setInterval(() => setI((x) => (x + 1) % campaigns.length), 6000);
    return () => clearInterval(id);
  }, [campaigns.length]);
  const c = campaigns.length ? campaigns[i % campaigns.length] : null;
  const texture = useAdTexture(c, 0, 0);
  const spin = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (spin.current) spin.current.rotation.y += dt * 0.12;
  });
  const W = 12;
  const H = 8;
  const Y = 16;
  return (
    <group>
      <mesh position={[0, Y / 2, 0]}>
        <cylinderGeometry args={[1.2, 1.8, Y, 16]} />
        <meshStandardMaterial color="#141826" metalness={0.9} roughness={0.25} />
      </mesh>
      <group ref={spin} position={[0, Y + H / 2, 0]}>
        {[0, 1, 2, 3].map((k) => (
          <group key={k} rotation-y={(k * Math.PI) / 2}>
            <mesh position={[0, 0, W / 2 + 0.02]} onClick={(e) => (e.stopPropagation(), c && onSelect(c, 0))}>
              <planeGeometry args={[W, H]} />
              <meshBasicMaterial map={texture} toneMapped={false} />
            </mesh>
          </group>
        ))}
        <mesh>
          <boxGeometry args={[W - 0.05, H + 0.6, W - 0.05]} />
          <meshStandardMaterial color="#05060a" />
        </mesh>
        <mesh position={[0, H / 2 + 0.5, 0]}>
          <boxGeometry args={[W + 0.4, 0.25, W + 0.4]} />
          <meshBasicMaterial color={c?.palette.accent ?? "#7cf7ff"} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

// ---------- Players ----------

function Avatar({ color, name, isMe }: { color: string; name: string; isMe?: boolean }) {
  return (
    <group>
      <mesh position-y={1}>
        <capsuleGeometry args={[0.45, 1, 6, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.45, 0.38]}>
        <boxGeometry args={[0.55, 0.18, 0.12]} />
        <meshBasicMaterial color="#05060a" />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.02}>
        <ringGeometry args={[0.6, 0.8, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} toneMapped={false} />
      </mesh>
      {!isMe && (
        <Html position={[0, 2.6, 0]} center distanceFactor={14} zIndexRange={[10, 0]}>
          <div className="pointer-events-none whitespace-nowrap rounded-full border border-white/15 bg-black/70 px-2.5 py-1 font-mono text-[11px] text-white backdrop-blur">
            <span className="mr-1.5 inline-block size-1.5 rounded-full" style={{ background: color }} />
            {name}
          </div>
        </Html>
      )}
    </group>
  );
}

function Others({ players }: { players: Player[] }) {
  return (
    <>
      {players.map((p) => (
        <Ghost key={p.id} p={p} />
      ))}
    </>
  );
}

function Ghost({ p }: { p: Player }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const k = 1 - Math.exp(-dt * 6);
    g.position.x += (p.x - g.position.x) * k;
    g.position.z += (p.z - g.position.z) * k;
    g.rotation.y += (p.ry - g.rotation.y) * k;
  });
  return (
    <group ref={ref} position={[p.x, 0, p.z]}>
      <Avatar color={p.color} name={p.name} />
    </group>
  );
}

export type Pose = { x: number; z: number; ry: number };

function Me({
  color,
  pose,
  target,
  tracker,
  teleport,
}: {
  color: string;
  pose: React.RefObject<Pose>;
  target: React.RefObject<THREE.Vector3 | null>;
  tracker: Tracker;
  teleport: Pose | null;
}) {
  const ref = useRef<THREE.Group>(null);
  const keys = useRef(new Set<string>());
  const yaw = useRef(pose.current.ry + Math.PI);
  const drag = useRef<{ x: number } | null>(null);
  const { camera, gl } = useThree();

  useEffect(() => {
    if (!teleport) return;
    pose.current = { ...teleport };
    yaw.current = teleport.ry + Math.PI;
    target.current = null;
  }, [teleport, pose, target]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      keys.current.add(e.key.toLowerCase());
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    const el = gl.domElement;
    const pd = (e: PointerEvent) => (drag.current = { x: e.clientX });
    const pm = (e: PointerEvent) => {
      if (!drag.current) return;
      yaw.current -= (e.clientX - drag.current.x) * 0.006;
      drag.current.x = e.clientX;
    };
    const pu = () => (drag.current = null);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    el.addEventListener("pointerdown", pd);
    window.addEventListener("pointermove", pm);
    window.addEventListener("pointerup", pu);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      el.removeEventListener("pointerdown", pd);
      window.removeEventListener("pointermove", pm);
      window.removeEventListener("pointerup", pu);
    };
  }, [gl]);

  const camPos = useRef(new THREE.Vector3(0, 6, 12));
  const look = useRef(new THREE.Vector3());

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const k = keys.current;
    const p = pose.current;
    const run = k.has("shift") ? 2 : 1;
    const turn = (k.has("arrowleft") || k.has("q") ? 1 : 0) - (k.has("arrowright") || k.has("e") ? 1 : 0);
    yaw.current += turn * dt * 2.2;
    const fwd = (k.has("w") || k.has("z") || k.has("arrowup") ? 1 : 0) - (k.has("s") || k.has("arrowdown") ? 1 : 0);
    const side = (k.has("d") ? 1 : 0) - (k.has("a") ? 1 : 0);
    // Camera looks along -yaw; forward is away from the camera.
    const fx = -Math.sin(yaw.current);
    const fz = -Math.cos(yaw.current);
    let mx = (fx * fwd - fz * side) * 11 * run * dt;
    let mz = (fz * fwd + fx * side) * 11 * run * dt;

    if (fwd || side) target.current = null;
    else if (target.current) {
      const dx = target.current.x - p.x;
      const dz = target.current.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.5) target.current = null;
      else {
        const s = Math.min(d, 14 * dt);
        mx = (dx / d) * s;
        mz = (dz / d) * s;
      }
    }
    if (mx || mz) {
      [p.x, p.z] = collide(p.x + mx, p.z + mz);
      const want = Math.atan2(mx, mz);
      let diff = want - p.ry;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      p.ry += diff * Math.min(1, dt * 10);
    }
    const g = ref.current!;
    g.position.set(p.x, 0, p.z);
    g.rotation.y = p.ry;

    const want = new THREE.Vector3(p.x + Math.sin(yaw.current) * 13, 6.5, p.z + Math.cos(yaw.current) * 13);
    camPos.current.lerp(want, 1 - Math.exp(-dt * 6));
    camera.position.copy(camPos.current);
    look.current.lerp(new THREE.Vector3(p.x - Math.sin(yaw.current) * 6, 5, p.z - Math.cos(yaw.current) * 6), 1 - Math.exp(-dt * 8));
    camera.lookAt(look.current);
    tracker.tick(camera);
  });

  return (
    <group ref={ref}>
      <Avatar color={color} name="you" isMe />
    </group>
  );
}

// ---------- Root ----------

export function Scene({
  campaigns,
  players,
  color,
  pose,
  teleport,
  tracker,
  focusId,
  onSelect,
}: {
  campaigns: Campaign[];
  players: Player[];
  color: string;
  pose: React.RefObject<Pose>;
  teleport: Pose | null;
  tracker: Tracker;
  focusId: string | null;
  onSelect: (c: Campaign, variant: number) => void;
}) {
  const target = useRef<THREE.Vector3 | null>(null);
  const shown = Math.max(campaigns.length + 4, 16);
  const marker = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!marker.current) return;
    marker.current.visible = !!target.current;
    if (target.current) marker.current.position.set(target.current.x, 0.05, target.current.z);
  });

  return (
    <>
      <color attach="background" args={["#04050a"]} />
      <fog attach="fog" args={["#04050a", 40, 190]} />
      <ambientLight intensity={0.5} color="#8fa3ff" />
      <hemisphereLight args={["#3b4a8a", "#05060a", 0.6]} />
      <directionalLight position={[60, 90, 30]} intensity={0.6} color="#b9c6ff" />
      <Stars radius={260} depth={60} count={2500} factor={6} fade speed={0.5} />
      <group
        onClick={(e) => {
          if (e.delta > 4) return;
          const [x, z] = collide(e.point.x, e.point.z);
          target.current = new THREE.Vector3(x, 0, z);
        }}
      >
        <Ground />
      </group>
      <Buildings />
      <Tower campaigns={campaigns} onSelect={onSelect} />
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
      <mesh ref={marker} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.5, 0.8, 32]} />
        <meshBasicMaterial color="#7cf7ff" toneMapped={false} />
      </mesh>
      <Me color={color} pose={pose} target={target} tracker={tracker} teleport={teleport} />
      <Others players={players} />
    </>
  );
}
