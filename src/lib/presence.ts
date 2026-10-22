import "server-only";
import Redis from "iovalkey";
import { onWorkers } from "./runtime";
import type { Player } from "./types";

// Live players walking the city. Aiven Valkey holds one key per player with a
// short TTL plus a sorted set for fast listing; memory fallback otherwise.

const TTL_S = 12;
const g = globalThis as unknown as { __vk?: Redis; __players?: Map<string, Player> };

function connect(url: string, workers: boolean) {
  return new Redis(url, {
    tls: url.startsWith("rediss://") ? {} : undefined,
    maxRetriesPerRequest: 2,
    lazyConnect: false,
    ...(workers && { connectTimeout: 3000, retryStrategy: () => null }),
  });
}

/** Runs fn against Valkey, or returns null when VALKEY_URL is unset. */
async function valkey<T>(fn: (vk: Redis) => Promise<T>): Promise<T | null> {
  const url = process.env.VALKEY_URL;
  if (!url) return null;
  if (!onWorkers) return fn((g.__vk ??= connect(url, false)));
  const vk = connect(url, true);
  // The socket closes with the request; that is expected, not worth an unhandled rejection.
  vk.on("error", () => {});
  try {
    return await fn(vk);
  } finally {
    vk.disconnect();
  }
}

export async function upsertPlayer(p: Player): Promise<Player[]> {
  const now = Date.now();
  const players = await valkey(async (vk) => {
    const res = await vk
      .multi()
      .set(`player:${p.id}`, JSON.stringify({ ...p, t: now }), "EX", TTL_S)
      .zadd("players", now, p.id)
      .zremrangebyscore("players", 0, now - TTL_S * 1000)
      .zrange("players", 0, -1)
      .exec();
    const ids = (res?.[3]?.[1] as string[] | undefined) ?? [];
    if (ids.length === 0) return [];
    const raw = await vk.mget(...ids.map((id) => `player:${id}`));
    return raw.filter((r): r is string => !!r).map((r) => JSON.parse(r) as Player);
  });
  if (players) return players;
  g.__players ??= new Map();
  g.__players.set(p.id, { ...p, t: now });
  for (const [id, q] of g.__players) if (now - q.t > TTL_S * 1000) g.__players.delete(id);
  return [...g.__players.values()];
}

export async function playerCount(): Promise<number> {
  const now = Date.now();
  const count = await valkey((vk) => vk.zcount("players", now - TTL_S * 1000, "+inf"));
  if (count !== null) return count;
  return [...(g.__players?.values() ?? [])].filter((q) => now - q.t < TTL_S * 1000).length;
}
