import * as THREE from "three";
import type { TrackEvent } from "@/lib/types";
import type { Slot } from "./city";

// An impression = a billboard was on screen, within reading distance of the player,
// for at least DWELL_MS. Each (campaign, variant) counts at most once per
// COOLDOWN_MS per session.
const DWELL_MS = 1000;
const COOLDOWN_MS = 30_000;
const MAX_DIST = 30;

type Entry = { campaignId: string; slot: Slot; variant: () => number; seenFor: number };

export class Tracker {
  private entries = new Set<Entry>();
  private last = new Map<string, number>();
  private queue: TrackEvent[] = [];
  private lastTick = 0;
  private frustum = new THREE.Frustum();
  private m = new THREE.Matrix4();
  private v = new THREE.Vector3();
  private timer: ReturnType<typeof setInterval>;
  onImpression?: (campaignId: string) => void;

  constructor(private sessionId: string) {
    this.timer = setInterval(() => this.flush(), 2500);
  }

  register(campaignId: string, slot: Slot, variant: () => number) {
    const e: Entry = { campaignId, slot, variant, seenFor: 0 };
    this.entries.add(e);
    return () => void this.entries.delete(e);
  }

  /** focus: the point the camera follows (the player); distance is measured from there. */
  tick(camera: THREE.Camera, focus: THREE.Vector3) {
    const now = performance.now();
    const dt = now - this.lastTick;
    if (dt < 250) return;
    this.lastTick = now;
    this.m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.m);
    for (const e of this.entries) {
      this.v.set(e.slot.x, 5, e.slot.z);
      const dist = Math.hypot(focus.x - e.slot.x, focus.z - e.slot.z);
      const visible = dist < MAX_DIST && this.frustum.containsPoint(this.v);
      e.seenFor = visible ? e.seenFor + Math.min(dt, 500) : 0;
      if (e.seenFor < DWELL_MS) continue;
      const variant = e.variant();
      const key = `${e.campaignId}:${variant}`;
      if (now - (this.last.get(key) ?? -Infinity) < COOLDOWN_MS) continue;
      this.last.set(key, now);
      this.queue.push({ type: "impression", campaignId: e.campaignId, variant, sessionId: this.sessionId, source: "world" });
      this.onImpression?.(e.campaignId);
    }
  }

  click(campaignId: string, variant: number, source = "world") {
    this.queue.push({ type: "click", campaignId, variant, sessionId: this.sessionId, source });
    this.flush();
  }

  flush() {
    if (this.queue.length === 0) return;
    const events = this.queue.splice(0, 200);
    const body = JSON.stringify({ events });
    if (navigator.sendBeacon?.(`/api/events`, new Blob([body], { type: "application/json" }))) return;
    fetch("/api/events", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true }).catch(
      () => this.queue.unshift(...events),
    );
  }

  dispose() {
    clearInterval(this.timer);
    this.flush();
  }
}
