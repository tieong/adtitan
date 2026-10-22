import type { CSSProperties } from "react";
import type { Campaign } from "@/lib/types";
import { imageUrl } from "@/lib/format";

// The ad creative itself (same layout as the billboard texture in world/paint.ts).
// It is the advertiser's content, so it uses the campaign palette and inline styles,
// not Lime tokens; container units keep it proportional at any width.

const font = '"Hanken Grotesk", system-ui, sans-serif';

export function AdCard({ campaign: c, variant = 0, className = "" }: { campaign: Campaign; variant?: number; className?: string }) {
  const v = c.variants[variant] ?? c.variants[0];
  const img = imageUrl(c);
  const root: CSSProperties = {
    containerType: "inline-size",
    position: "relative",
    aspectRatio: "3 / 2",
    width: "100%",
    overflow: "hidden",
    borderRadius: 16,
    background: c.palette.bg,
    color: c.palette.fg,
    fontFamily: font,
  };
  return (
    <div className={className} style={root} role="img" aria-label={`${c.name} ad: ${v.headline}. ${v.subline}`}>
      {img ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(90deg, ${c.palette.bg}f2 0%, ${c.palette.bg}b0 45%, ${c.palette.bg}10 85%)`,
            }}
          />
        </>
      ) : (
        <>
          <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 85% 20%, ${c.palette.accent}aa, transparent 65%)` }} />
          <div style={{ position: "absolute", right: "8%", top: "50%", transform: "translateY(-50%)", fontSize: "30cqw", lineHeight: 1 }}>
            {c.emoji}
          </div>
        </>
      )}
      <div style={{ position: "relative", display: "flex", flexDirection: "column", height: "100%", width: "62%", padding: "6cqw" }}>
        <div style={{ fontSize: "2.8cqw", fontWeight: 600 }}>
          {c.emoji}&nbsp; {c.name}
        </div>
        <div style={{ marginTop: "1.2cqw", height: "0.5cqw", width: "5.3cqw", background: c.palette.accent }} />
        <div style={{ marginTop: "auto", fontSize: "7.6cqw", fontWeight: 600, lineHeight: 1.02, letterSpacing: "-0.03em", textWrap: "balance" }}>
          {v.headline}
        </div>
        <div style={{ marginTop: "2cqw", fontSize: "3cqw", lineHeight: 1.35, opacity: 0.82, textWrap: "pretty" }}>{v.subline}</div>
        <div style={{ marginTop: "auto", paddingTop: "3cqw" }}>
          <span
            style={{
              display: "inline-block",
              borderRadius: 999,
              padding: "1.5cqw 3cqw",
              fontSize: "3cqw",
              fontWeight: 600,
              background: c.palette.accent,
              color: c.palette.bg,
            }}
          >
            {v.cta} &nbsp;→
          </span>
        </div>
      </div>
    </div>
  );
}
