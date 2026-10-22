// Deterministic layout of the isometric city, shared by the scene, collisions,
// the NPC walkers and the minimap. World units; y is up. The camera looks from
// +x/+z toward the origin, so the +x/+z side of anything faces the viewer.

export const SPACING = 30; // block centre to block centre
export const BLOCK = 20; // block footprint; the rest is road
export const HALF = 2; // blocks from -HALF..HALF on each axis
export const LIMIT = (HALF + 0.5) * SPACING;
export const ROAD = SPACING - BLOCK;

export type Block = { x: number; z: number; i: number; j: number; plaza: boolean };
export type Rect = { x0: number; z0: number; x1: number; z1: number };
export type SpriteName =
  | "ramen" | "cafe" | "startup" | "tower" | "arcade" | "konbini" | "library" | "hall"
  | "sakura" | "tree" | "vending" | "bench" | "fountain";
/** A sprite standing in the world: anchor is its front ground point, width in world units. */
export type Prop = { sprite: SpriteName; x: number; z: number; width: number; solid?: Rect };
export type Slot = { x: number; z: number; ry: number; index: number };

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

export const blocks: Block[] = [];
for (let i = -HALF; i <= HALF; i++) {
  for (let j = -HALF; j <= HALF; j++) {
    blocks.push({ x: i * SPACING, z: j * SPACING, i, j, plaza: i === 0 && j === 0 });
  }
}

const BUILDINGS: { sprite: SpriteName; width: number; foot: number }[] = [
  { sprite: "ramen", width: 13, foot: 10 },
  { sprite: "cafe", width: 13, foot: 10 },
  { sprite: "startup", width: 15, foot: 11 },
  { sprite: "tower", width: 9, foot: 7 },
  { sprite: "arcade", width: 14, foot: 10 },
  { sprite: "konbini", width: 14, foot: 10 },
  { sprite: "library", width: 14, foot: 10 },
];

export const props: Prop[] = [];
export const slots: Slot[] = [];
{
  const r = rng(11);
  let b = 0;
  const raw: Omit<Slot, "index">[] = [];
  for (const blk of blocks) {
    if (blk.plaza) {
      props.push({ sprite: "fountain", x: blk.x + 3.5, z: blk.z + 3.5, width: 10, solid: rect(blk.x, blk.z, 4.2) });
      // The hackathon hall sits behind the plaza, the big screen in front of it.
      props.push({ sprite: "hall", x: blk.x - 4, z: blk.z - 4, width: 17, solid: rectAt(blk.x - 9, blk.z - 9, 6) });
      for (const [dx, dz] of [[-8, 6], [6, -8]]) props.push({ sprite: "sakura", x: blk.x + dx, z: blk.z + dz, width: 6, solid: rect(blk.x + dx - 0.6, blk.z + dz - 0.6, 0.8) });
      for (const [dx, dz] of [[7, 3], [3, 7]]) props.push({ sprite: "bench", x: blk.x + dx, z: blk.z + dz, width: 3.2 });
      continue;
    }
    // The building stands toward the back of its block; the front corner keeps room for an ad.
    const kind = blk.i === -HALF && blk.j === -HALF ? { sprite: "tower" as const, width: 9, foot: 7 } : BUILDINGS[b++ % BUILDINGS.length];
    const cx = blk.x - 3;
    const cz = blk.z - 3;
    const h = kind.foot / 2;
    props.push({ sprite: kind.sprite, x: cx + h, z: cz + h, width: kind.width, solid: rectAt(cx, cz, h) });
    // Greenery and street furniture on the open corners.
    const tree = r() > 0.5 ? "sakura" : "tree";
    props.push({ sprite: tree, x: blk.x - 8, z: blk.z + 7, width: 5.5, solid: rect(blk.x - 8.6, blk.z + 6.4, 0.8) });
    props.push({ sprite: r() > 0.5 ? "tree" : "sakura", x: blk.x + 7, z: blk.z - 8, width: 5.5, solid: rect(blk.x + 6.4, blk.z - 8.6, 0.8) });
    if (r() > 0.45) props.push({ sprite: "vending", x: blk.x + 8.5, z: blk.z + 1, width: 1.8, solid: rect(blk.x + 8, blk.z + 0.5, 0.7) });
    if (r() > 0.5) props.push({ sprite: "bench", x: blk.x + 1, z: blk.z + 8.6, width: 3.2 });
    // Billboard on the front corner, turned to face the camera.
    raw.push({ x: blk.x + 5.5, z: blk.z + 5.5, ry: Math.PI / 4 });
  }
  // First campaigns land closest to the plaza.
  raw.sort((p, q) => Math.hypot(p.x, p.z) - Math.hypot(q.x, q.z) || p.x - q.x || p.z - q.z);
  raw.forEach((s, index) => slots.push({ ...s, index }));
}

function rect(x: number, z: number, h: number): Rect {
  return { x0: x - h, z0: z - h, x1: x + h, z1: z + h };
}
function rectAt(cx: number, cz: number, h: number): Rect {
  return rect(cx, cz, h);
}

const solids: Rect[] = [
  ...props.filter((p) => p.solid).map((p) => p.solid!),
  // Billboard posts.
  ...slots.map((s) => rect(s.x, s.z, 1.2)),
];

/** Push a point out of every solid footprint and keep it inside the city. */
export function collide(x: number, z: number, radius = 0.6): [number, number] {
  for (const s of solids) {
    const x0 = s.x0 - radius;
    const x1 = s.x1 + radius;
    const z0 = s.z0 - radius;
    const z1 = s.z1 + radius;
    if (x > x0 && x < x1 && z > z0 && z < z1) {
      const push = [x - x0, x1 - x, z - z0, z1 - z];
      const m = Math.min(...push);
      if (m === push[0]) x = x0;
      else if (m === push[1]) x = x1;
      else if (m === push[2]) z = z0;
      else z = z1;
    }
  }
  const lim = LIMIT - 1;
  return [Math.max(-lim, Math.min(lim, x)), Math.max(-lim, Math.min(lim, z))];
}

/** Where to stand to read a billboard: a few steps toward the camera. */
export function viewpoint(s: Slot, dist = 7): { x: number; z: number; ry: number } {
  return { x: s.x + Math.sin(s.ry) * dist, z: s.z + Math.cos(s.ry) * dist, ry: s.ry + Math.PI };
}

/** Road intersections; NPCs walk from one to a neighbour. */
export const nodes: { x: number; z: number }[] = [];
for (let i = -HALF; i <= HALF + 1; i++) {
  for (let j = -HALF; j <= HALF + 1; j++) {
    nodes.push({ x: (i - 0.5) * SPACING, z: (j - 0.5) * SPACING });
  }
}
export function neighbours(n: { x: number; z: number }) {
  return nodes.filter((m) => Math.abs(Math.hypot(m.x - n.x, m.z - n.z) - SPACING) < 0.1);
}
