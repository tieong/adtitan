"use client";

import { useEffect, useState } from "react";

const HOLD_MS = 2400;

/**
 * Cycles through words; each one flips in letter by letter. Every word is stacked in
 * the same grid cell (the inactive ones hidden), so the slot is always as wide as the
 * longest word and the surrounding text never reflows. Screen readers get the first
 * word only, and with reduced motion the first word simply stays.
 */
export function RotatingWord({ words }: { words: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setI((n) => (n + 1) % words.length), HOLD_MS);
    return () => clearInterval(id);
  }, [words.length]);
  return (
    <span className="rotating-word text-accent-line">
      <span className="sr-only">{words[0]}</span>
      {words.map((word, w) => (
        <span key={w === i ? `${word}-on` : word} aria-hidden="true" className={w === i ? "rotating-slot" : "rotating-slot invisible"}>
          {w === i
            ? [...word].map((ch, k) => (
                <span key={k} className="rotating-char" style={{ animationDelay: `${k * 28}ms` }}>
                  {ch === " " ? " " : ch}
                </span>
              ))
            : word}
        </span>
      ))}
    </span>
  );
}
