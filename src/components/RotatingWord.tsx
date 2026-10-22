"use client";

import { useEffect, useState } from "react";

const HOLD_MS = 2400;

/**
 * Cycles through words; each one flips in letter by letter. Screen readers get the
 * first word only, and with reduced motion the first word simply stays.
 */
export function RotatingWord({ words }: { words: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setI((n) => (n + 1) % words.length), HOLD_MS);
    return () => clearInterval(id);
  }, [words.length]);
  const word = words[i];
  return (
    <span className="rotating-word text-accent-line">
      <span className="sr-only">{words[0]}</span>
      <span key={word} aria-hidden="true" className="inline-block whitespace-nowrap">
        {[...word].map((ch, k) => (
          <span key={k} className="rotating-char" style={{ animationDelay: `${k * 28}ms` }}>
            {ch === " " ? " " : ch}
          </span>
        ))}
      </span>
    </span>
  );
}
