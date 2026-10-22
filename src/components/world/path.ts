import { LIMIT, solids } from "./city";

// Walkability grid over the city at CELL resolution, solids inflated by the
// walker radius, for A* click-to-move.
const CELL = 1;
const RADIUS = 0.7;
const N = Math.ceil((LIMIT * 2) / CELL);
const blocked = new Uint8Array(N * N);

const toCell = (v: number) => Math.min(N - 1, Math.max(0, Math.floor((v + LIMIT) / CELL)));
const toWorld = (c: number) => -LIMIT + (c + 0.5) * CELL;

for (const s of solids) {
  for (let cx = toCell(s.x0 - RADIUS); cx <= toCell(s.x1 + RADIUS); cx++) {
    for (let cz = toCell(s.z0 - RADIUS); cz <= toCell(s.z1 + RADIUS); cz++) blocked[cz * N + cx] = 1;
  }
}

function free(cx: number, cz: number) {
  return cx >= 1 && cz >= 1 && cx < N - 1 && cz < N - 1 && !blocked[cz * N + cx];
}

/** Nearest free cell, searching outward in rings (for clicks on a building). */
function nearestFree(cx: number, cz: number): [number, number] | null {
  if (free(cx, cz)) return [cx, cz];
  for (let r = 1; r < 12; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (const dz of [-r, r]) {
        if (free(cx + dx, cz + dz)) return [cx + dx, cz + dz];
        if (free(cx + dz, cz + dx)) return [cx + dz, cz + dx];
      }
    }
  }
  return null;
}

/** True when the straight segment between two points crosses no blocked cell. */
function clear(ax: number, az: number, bx: number, bz: number) {
  const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / (CELL * 0.5));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (!free(toCell(ax + (bx - ax) * t), toCell(az + (bz - az) * t))) return false;
  }
  return true;
}

class Heap {
  private a: number[] = [];
  constructor(private score: Float32Array) {}
  get size() {
    return this.a.length;
  }
  push(i: number) {
    const a = this.a;
    a.push(i);
    let k = a.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (this.score[a[p]] <= this.score[a[k]]) break;
      [a[p], a[k]] = [a[k], a[p]];
      k = p;
    }
  }
  pop() {
    const a = this.a;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1;
        const r = l + 1;
        let m = k;
        if (l < a.length && this.score[a[l]] < this.score[a[m]]) m = l;
        if (r < a.length && this.score[a[r]] < this.score[a[m]]) m = r;
        if (m === k) break;
        [a[m], a[k]] = [a[k], a[m]];
        k = m;
      }
    }
    return top;
  }
}

const g = new Float32Array(N * N);
const f = new Float32Array(N * N);
const from = new Int32Array(N * N);
const seen = new Uint32Array(N * N);
let stamp = 0;
const DIRS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
] as const;

/**
 * Waypoints from (ax, az) to (bx, bz) around every solid, smoothed so the walker
 * cuts corners where the way is clear. Empty when unreachable.
 */
export function findPath(ax: number, az: number, bx: number, bz: number): { x: number; z: number }[] {
  if (clear(ax, az, bx, bz) && free(toCell(bx), toCell(bz))) return [{ x: bx, z: bz }];
  const start = nearestFree(toCell(ax), toCell(az));
  const goal = nearestFree(toCell(bx), toCell(bz));
  if (!start || !goal) return [];
  const s = start[1] * N + start[0];
  const t = goal[1] * N + goal[0];
  stamp++;
  const h = (i: number) => {
    const dx = Math.abs((i % N) - goal[0]);
    const dz = Math.abs(Math.floor(i / N) - goal[1]);
    return dx + dz + (Math.SQRT2 - 2) * Math.min(dx, dz);
  };
  const open = new Heap(f);
  g[s] = 0;
  f[s] = h(s);
  from[s] = -1;
  seen[s] = stamp;
  open.push(s);
  let found = false;
  let budget = 40000;
  while (open.size && budget-- > 0) {
    const cur = open.pop();
    if (cur === t) {
      found = true;
      break;
    }
    const cx = cur % N;
    const cz = Math.floor(cur / N);
    for (const [dx, dz, cost] of DIRS) {
      const nx = cx + dx;
      const nz = cz + dz;
      if (!free(nx, nz)) continue;
      // No cutting through the corner of a solid diagonally.
      if (dx && dz && (!free(cx + dx, cz) || !free(cx, cz + dz))) continue;
      const n = nz * N + nx;
      const ng = g[cur] + cost;
      if (seen[n] === stamp && ng >= g[n]) continue;
      seen[n] = stamp;
      g[n] = ng;
      f[n] = ng + h(n);
      from[n] = cur;
      open.push(n);
    }
  }
  if (!found) return [];
  const cells: { x: number; z: number }[] = [];
  for (let i = t; i !== -1; i = from[i]) cells.push({ x: toWorld(i % N), z: toWorld(Math.floor(i / N)) });
  cells.reverse();
  cells[cells.length - 1] = free(toCell(bx), toCell(bz)) ? { x: bx, z: bz } : cells[cells.length - 1];
  // String pulling: keep only the waypoints needed to stay clear of solids.
  const out: { x: number; z: number }[] = [];
  let anchor = { x: ax, z: az };
  let i = 0;
  while (i < cells.length - 1) {
    let j = cells.length - 1;
    while (j > i + 1 && !clear(anchor.x, anchor.z, cells[j].x, cells[j].z)) j--;
    out.push(cells[j]);
    anchor = cells[j];
    i = j;
  }
  if (!out.length) out.push(cells[cells.length - 1]);
  return out;
}
