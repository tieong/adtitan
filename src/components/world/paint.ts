import type { Campaign } from "@/lib/types";

export const AD_W = 1200;
export const AD_H = 800;

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
  start: number,
  weight = 800,
) {
  let size = start;
  let lines: string[] = [];
  while (size > 24) {
    ctx.font = `${weight} ${size}px "Geist", "Inter", system-ui, sans-serif`;
    lines = wrap(ctx, text, maxWidth);
    if (lines.length <= maxLines && lines.every((l) => ctx.measureText(l).width <= maxWidth)) break;
    size -= 4;
  }
  return { size, lines };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Draws one ad variant onto a 3:2 canvas, the same layout as the HTML AdCard. */
export function paintAd(
  ctx: CanvasRenderingContext2D,
  c: Campaign,
  variant: number,
  img: HTMLImageElement | null,
) {
  const v = c.variants[variant] ?? c.variants[0];
  const { bg, fg, accent } = c.palette;
  ctx.save();
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, AD_W, AD_H);

  if (img) {
    const s = Math.max(AD_W / img.width, AD_H / img.height);
    const w = img.width * s;
    const h = img.height * s;
    ctx.drawImage(img, (AD_W - w) / 2, (AD_H - h) / 2, w, h);
    const shade = ctx.createLinearGradient(0, 0, AD_W * 0.85, 0);
    shade.addColorStop(0, `${bg}f2`);
    shade.addColorStop(0.55, `${bg}b0`);
    shade.addColorStop(1, `${bg}10`);
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, AD_W, AD_H);
  } else {
    const glow = ctx.createRadialGradient(AD_W * 0.85, AD_H * 0.2, 20, AD_W * 0.85, AD_H * 0.2, AD_W * 0.8);
    glow.addColorStop(0, `${accent}aa`);
    glow.addColorStop(1, `${accent}00`);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, AD_W, AD_H);
    ctx.font = `360px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.globalAlpha = 0.9;
    ctx.fillText(c.emoji, AD_W * 0.8, AD_H * 0.48);
    ctx.globalAlpha = 1;
  }

  const pad = 72;
  const textW = img ? AD_W * 0.62 : AD_W * 0.58;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  // Brand line
  ctx.fillStyle = fg;
  ctx.font = `600 34px "Geist", system-ui, sans-serif`;
  ctx.fillText(`${c.emoji}  ${c.name}`, pad, pad + 26);
  ctx.fillStyle = accent;
  ctx.fillRect(pad, pad + 50, 64, 6);

  // Headline
  const head = fitText(ctx, v.headline, textW, 3, 104);
  ctx.fillStyle = fg;
  let y = 290 - (head.lines.length - 1) * head.size * 0.25;
  for (const l of head.lines) {
    ctx.fillText(l, pad, y);
    y += head.size * 1.02;
  }

  // Subline
  const sub = fitText(ctx, v.subline, textW, 2, 38, 400);
  ctx.globalAlpha = 0.82;
  y += 18;
  for (const l of sub.lines) {
    ctx.fillText(l, pad, y);
    y += sub.size * 1.3;
  }
  ctx.globalAlpha = 1;

  // CTA pill
  ctx.font = `700 38px "Geist", system-ui, sans-serif`;
  const label = `${v.cta}  →`;
  const cw = ctx.measureText(label).width + 72;
  roundRect(ctx, pad, AD_H - pad - 84, cw, 84, 42);
  ctx.fillStyle = accent;
  ctx.fill();
  ctx.fillStyle = bg;
  ctx.textBaseline = "middle";
  ctx.fillText(label, pad + 36, AD_H - pad - 41);

  // Footer tag
  ctx.textAlign = "right";
  ctx.font = `500 26px "Geist Mono", ui-monospace, monospace`;
  ctx.fillStyle = fg;
  ctx.globalAlpha = 0.55;
  ctx.fillText(`AD · ${c.category.toUpperCase()}`, AD_W - pad, AD_H - pad - 41);
  ctx.globalAlpha = 1;
  ctx.restore();
}

export function paintPlaceholder(ctx: CanvasRenderingContext2D, n: number) {
  ctx.fillStyle = "#07080d";
  ctx.fillRect(0, 0, AD_W, AD_H);
  ctx.strokeStyle = "#ffffff22";
  ctx.lineWidth = 2;
  for (let x = 0; x < AD_W; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, AD_H);
    ctx.stroke();
  }
  for (let y = 0; y < AD_H; y += 60) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(AD_W, y);
    ctx.stroke();
  }
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 110px "Geist", system-ui, sans-serif`;
  ctx.fillText("YOUR AD HERE", AD_W / 2, AD_H / 2 - 20);
  ctx.font = `500 40px "Geist Mono", ui-monospace, monospace`;
  ctx.fillStyle = "#7cf7ff";
  ctx.fillText(`Paste your repo → billboard #${n}`, AD_W / 2, AD_H / 2 + 60);
}
