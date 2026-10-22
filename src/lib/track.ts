"use client";

import type { TrackEvent } from "./types";
import { me } from "./client";

// Batches ad events from the browser to /api/events (ClickHouse).
const queue: TrackEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
const seen = new Map<string, number>();

function flush() {
  timer = null;
  if (!queue.length) return;
  const body = JSON.stringify({ events: queue.splice(0, 200) });
  if (navigator.sendBeacon?.("/api/events", new Blob([body], { type: "application/json" }))) return;
  fetch("/api/events", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {});
}

export function track(type: TrackEvent["type"], campaignId: string, variant: number, source: string) {
  // One impression per ad per 30s per viewer, like the city.
  if (type === "impression") {
    const key = `${campaignId}:${variant}:${source}`;
    const now = Date.now();
    if (now - (seen.get(key) ?? 0) < 30_000) return;
    seen.set(key, now);
  }
  queue.push({ type, campaignId, variant, sessionId: me().id, source });
  if (type === "click") flush();
  else timer ??= setTimeout(flush, 1500);
}
