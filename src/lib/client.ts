"use client";

import type { Campaign } from "./types";

const ADJ = ["Neon", "Swift", "Quiet", "Lucky", "Cosmic", "Pixel", "Turbo", "Lunar", "Solar", "Velvet"];
const NOUN = ["Fox", "Hacker", "Otter", "Comet", "Panda", "Falcon", "Koala", "Robot", "Tiger", "Whale"];
const COLORS = ["#7cf7ff", "#ff6bd6", "#ffd166", "#8cff7a", "#b69cff", "#ff8a5c"];

export type Me = { id: string; name: string; color: string };

export function me(): Me {
  const raw = localStorage.getItem("adcity:me");
  if (raw) return JSON.parse(raw) as Me;
  const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
  const m = { id: crypto.randomUUID(), name: `${pick(ADJ)} ${pick(NOUN)}`, color: pick(COLORS) };
  localStorage.setItem("adcity:me", JSON.stringify(m));
  return m;
}

export function visitUrl(c: Campaign, variant: number, source: string) {
  return `/r/${c.id}?v=${variant}&src=${source}&s=${typeof window === "undefined" ? "anon" : me().id}`;
}
