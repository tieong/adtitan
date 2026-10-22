import type { Campaign } from "@/lib/types";
import { imageUrl } from "@/lib/format";

/** HTML twin of the billboard texture (same layout as world/paint.ts). */
export function AdCard({ campaign: c, variant = 0, className = "" }: { campaign: Campaign; variant?: number; className?: string }) {
  const v = c.variants[variant] ?? c.variants[0];
  const img = imageUrl(c);
  return (
    <div
      className={`@container relative aspect-[3/2] w-full overflow-hidden rounded-2xl ${className}`}
      style={{ background: c.palette.bg, color: c.palette.fg }}
    >
      {img ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img} alt="" className="absolute inset-0 size-full object-cover" />
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(90deg, ${c.palette.bg}f2 0%, ${c.palette.bg}b0 45%, ${c.palette.bg}10 85%)` }}
          />
        </>
      ) : (
        <>
          <div
            className="absolute inset-0"
            style={{ background: `radial-gradient(circle at 85% 20%, ${c.palette.accent}aa, transparent 65%)` }}
          />
          <div className="absolute right-[8%] top-1/2 -translate-y-1/2 text-[30cqw] leading-none">{c.emoji}</div>
        </>
      )}
      <div className="relative flex h-full w-[62%] flex-col p-[6cqw]">
        <div className="text-[2.8cqw] font-semibold">
          {c.emoji}&nbsp; {c.name}
        </div>
        <div className="mt-[1.2cqw] h-[0.5cqw] w-[5.3cqw]" style={{ background: c.palette.accent }} />
        <div className="mt-auto text-[7.6cqw] font-extrabold leading-[1.02] tracking-tight text-balance">{v.headline}</div>
        <div className="mt-[2cqw] text-[3cqw] leading-snug opacity-80 text-pretty">{v.subline}</div>
        <div className="mt-auto pt-[3cqw]">
          <span
            className="inline-block rounded-full px-[3cqw] py-[1.5cqw] text-[3cqw] font-bold"
            style={{ background: c.palette.accent, color: c.palette.bg }}
          >
            {v.cta} &nbsp;→
          </span>
        </div>
      </div>
      <div className="absolute bottom-[6cqw] right-[6cqw] font-mono text-[2.1cqw] uppercase opacity-55">AD · {c.category}</div>
    </div>
  );
}
