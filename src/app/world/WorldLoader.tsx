"use client";

import dynamic from "next/dynamic";

const World = dynamic(() => import("@/components/world/World"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 grid place-items-center bg-[#04050a] font-mono text-sm text-white/50">
      Building the city…
    </div>
  ),
});

export function WorldLoader({ focusId }: { focusId: string | null }) {
  return <World focusId={focusId} />;
}
