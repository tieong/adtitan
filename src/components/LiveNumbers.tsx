"use client";

import { useEffect, useState } from "react";
import NumberFlow from "@number-flow/react";

type Stats = { campaigns: number; impressions: number; clicks: number; visits: number; players: number };

/** One sentence of live totals; numbers roll only when they change. */
export function LiveNumbers({ initial }: { initial: Stats }) {
  const [s, setS] = useState(initial);
  useEffect(() => {
    const id = setInterval(() => {
      fetch("/api/stats")
        .then((r) => r.json())
        .then(setS)
        .catch(() => {});
    }, 4000);
    return () => clearInterval(id);
  }, []);
  return (
    <p className="text-sm text-fg-2">
      <NumberFlow value={s.campaigns} className="font-medium text-fg" /> projects advertised,{" "}
      <NumberFlow value={s.impressions} className="font-medium text-fg" /> ad views and{" "}
      <NumberFlow value={s.visits} className="font-medium text-fg" /> visits sent to their sites so far.
    </p>
  );
}
