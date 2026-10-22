import type { Campaign } from "./types";

export function imageUrl(c: Campaign) {
  return c.hasImage ? `/api/campaigns/${c.id}/image` : null;
}

export function pct(x: number) {
  return `${(x * 100).toFixed(x > 0 && x < 0.1 ? 1 : 0)}%`;
}

export function compact(n: number) {
  return Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}
