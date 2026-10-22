"use client";

import type { Campaign } from "./types";

const ADJ = ["Neon", "Swift", "Quiet", "Lucky", "Cosmic", "Pixel", "Turbo", "Lunar", "Solar", "Velvet"];
const NOUN = ["Fox", "Hacker", "Otter", "Comet", "Panda", "Falcon", "Koala", "Robot", "Tiger", "Whale"];
const COLORS = ["#7cf7ff", "#ff6bd6", "#ffd166", "#8cff7a", "#b69cff", "#ff8a5c"];

export type Me = { id: string; name: string; color: string; avatar?: string };

// crypto.randomUUID only exists in secure contexts, and the site may be served over plain HTTP.
function newId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function me(): Me {
  const raw = localStorage.getItem("adcity:me");
  if (raw) return JSON.parse(raw) as Me;
  const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
  const m = { id: newId(), name: `${pick(ADJ)} ${pick(NOUN)}`, color: pick(COLORS) };
  localStorage.setItem("adcity:me", JSON.stringify(m));
  return m;
}

export function saveMe(m: Me) {
  localStorage.setItem("adcity:me", JSON.stringify(m));
}

export function visitUrl(c: Campaign, variant: number, source: string) {
  return `/r/${c.id}?v=${variant}&src=${source}&s=${typeof window === "undefined" ? "anon" : me().id}`;
}
