// Deterministic city layout shared by the scene, collisions and the minimap.

export const SPACING = 46; // block centre to block centre
export const BLOCK = 30; // block footprint (buildings + sidewalk)
export const HALF = 2; // blocks from -HALF..HALF on each axis
export const LIMIT = (HALF + 0.5) * SPACING;

export type Block = { x: number; z: number; plaza: boolean };
export type Building = { x: number; z: number; w: number; d: number; h: number; tint: number };
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
    blocks.push({ x: i * SPACING, z: j * SPACING, plaza: i === 0 && j === 0 });
  }
}

export const buildings: Building[] = [];
{
  const r = rng(7);
  for (const b of blocks) {
    if (b.plaza) continue;
    // 2x2 towers per block, inset from the sidewalk.
    const inner = BLOCK - 6;
    const cell = inner / 2;
    for (let a = 0; a < 2; a++) {
      for (let c = 0; c < 2; c++) {
        const far = Math.hypot(b.x, b.z) / SPACING;
        const w = cell - 1.5 - r() * 2;
        const d = cell - 1.5 - r() * 2;
        buildings.push({
          x: b.x - inner / 2 + cell * (a + 0.5),
          z: b.z - inner / 2 + cell * (c + 0.5),
          w,
          d,
          h: 14 + r() * 26 + far * 10,
          tint: r(),
        });
      }
    }
  }
}

// One billboard per block side, facing the street. Sorted so the first
// campaigns land closest to the spawn point in the plaza.
export const slots: Slot[] = (() => {
  const out: Omit<Slot, "index">[] = [];
  const edge = BLOCK / 2 + 1.2;
  for (const b of blocks) {
    if (b.plaza) continue;
    out.push({ x: b.x, z: b.z + edge, ry: 0 });
    out.push({ x: b.x, z: b.z - edge, ry: Math.PI });
    out.push({ x: b.x + edge, z: b.z, ry: Math.PI / 2 });
    out.push({ x: b.x - edge, z: b.z, ry: -Math.PI / 2 });
  }
  // Only keep sides that face a street inside the city.
  const inside = out.filter((s) => Math.abs(s.x) < LIMIT - 4 && Math.abs(s.z) < LIMIT - 4);
  const facesStreet = inside.filter((s) => {
    const nx = s.x + Math.sin(s.ry) * 8;
    const nz = s.z + Math.cos(s.ry) * 8;
    return Math.abs(nx) < LIMIT - 6 && Math.abs(nz) < LIMIT - 6;
  });
  facesStreet.sort((p, q) => Math.hypot(p.x, p.z) - Math.hypot(q.x, q.z) || p.x - q.x || p.z - q.z);
  return facesStreet.map((s, index) => ({ ...s, index }));
})();

/** Push a point out of every block footprint (players walk on streets and the plaza). */
export function collide(x: number, z: number, radius = 0.8): [number, number] {
  const h = BLOCK / 2 + radius;
  for (const b of blocks) {
    if (b.plaza) continue;
    const dx = x - b.x;
    const dz = z - b.z;
    if (Math.abs(dx) < h && Math.abs(dz) < h) {
      const px = h - Math.abs(dx);
      const pz = h - Math.abs(dz);
      if (px < pz) x += Math.sign(dx || 1) * px;
      else z += Math.sign(dz || 1) * pz;
    }
  }
  const lim = LIMIT - 2;
  return [Math.max(-lim, Math.min(lim, x)), Math.max(-lim, Math.min(lim, z))];
}

/** Where to stand to look at a billboard. */
export function viewpoint(s: Slot, dist = 14): { x: number; z: number; ry: number } {
  return { x: s.x + Math.sin(s.ry) * dist, z: s.z + Math.cos(s.ry) * dist, ry: s.ry + Math.PI };
}
