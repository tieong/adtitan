import "server-only";
import type { Campaign } from "../types";
import type { Scene, VideoScript } from "./script";
import type { Voiceover, Word } from "./audio";

export type Format = "vertical" | "landscape";
export const SIZES: Record<Format, { w: number; h: number }> = {
  vertical: { w: 1080, h: 1920 },
  landscape: { w: 1920, h: 1080 },
};

export type Assets = { keyVisual: string | null; vo: string; music: string | null; whoosh: string | null; impact: string | null };

const VO_DELAY = 0.35;
const OUTRO = 2.2;

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Rough text fit: Inter ExtraBold averages ~0.58em per character. */
function fit(text: string, maxWidth: number, maxLines: number, start: number, min: number) {
  const words = text.split(/\s+/);
  for (let size = start; size > min; size -= 4) {
    const perLine = Math.floor(maxWidth / (size * 0.58));
    if (words.some((w) => w.length > perLine)) continue;
    let lines = 1;
    let len = 0;
    for (const w of words) {
      if (len && len + 1 + w.length > perLine) {
        lines++;
        len = w.length;
      } else len += (len ? 1 : 0) + w.length;
    }
    if (lines <= maxLines) return size;
  }
  return min;
}

function splitWords(text: string, cls: string) {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => `<span class="w ${cls}"><span class="wi">${esc(w)}</span></span>`)
    .join(" ");
}

/** Caption groups: at most 3 words, broken at pauses. */
function captionGroups(words: Word[]) {
  const groups: Word[][] = [];
  let g: Word[] = [];
  for (const w of words) {
    const prev = g[g.length - 1];
    if (g.length && (g.length >= 3 || w.start - prev.end > 0.28 || /[.!?,]$/.test(prev.text))) {
      groups.push(g);
      g = [];
    }
    g.push(w);
  }
  if (g.length) groups.push(g);
  return groups;
}

const KV_OPACITY: Record<Scene["kind"], number> = {
  hook: 0.6,
  problem: 0.2,
  solution: 0.95,
  features: 0.28,
  proof: 0.4,
  cta: 0.35,
};

export function compose(opts: {
  campaign: Campaign;
  script: VideoScript;
  vo: Voiceover;
  assets: Assets;
  format: Format;
}): { html: string; duration: number } {
  const { campaign: c, script, vo, assets, format } = opts;
  const { w: W, h: H } = SIZES[format];
  const u = Math.min(W, H) / 1080;
  const vertical = format === "vertical";
  const pad = Math.round((vertical ? 84 : 120) * u);
  const textW = W - pad * 2;
  const { bg, fg, accent } = c.palette;

  // Scene windows follow the voice: each scene starts just before its line.
  const n = script.scenes.length;
  const starts = script.scenes.map((_, i) => (i === 0 ? 0 : +(VO_DELAY + vo.scenes[i].start - 0.12).toFixed(3)));
  const duration = +(VO_DELAY + vo.duration + OUTRO).toFixed(2);
  const ends = starts.map((s, i) => (i < n - 1 ? starts[i + 1] : duration));

  const tl: string[] = [];
  const at = (t: number) => t.toFixed(3);

  // ---- scenes ----
  const sceneHtml = script.scenes
    .map((s, i) => {
      const S = starts[i];
      const E = ends[i];
      const id = `s${i}`;
      const titleSize = fit(s.title, textW, s.kind === "hook" ? 3 : 2, Math.round((s.kind === "hook" ? 150 : 124) * u), Math.round(56 * u));
      // Scene exit (not for the last one).
      if (i < n - 1) {
        tl.push(`tl.to("#${id} .inner",{y:${-40 * u},opacity:0,filter:"blur(${12 * u}px)",duration:0.25,ease:"power2.in"},${at(E - 0.25)});`);
      }
      tl.push(`tl.fromTo("#${id} .kicker",{y:${20 * u},opacity:0},{y:0,opacity:1,duration:0.35,ease:"power3.out"},${at(S + 0.05)});`);
      if (s.kind === "hook") {
        tl.push(
          `tl.fromTo("#${id} .wi",{yPercent:110,rotate:6},{yPercent:0,rotate:0,duration:0.55,ease:"expo.out",stagger:0.09},${at(S + 0.15)});`,
        );
        tl.push(`tl.fromTo("#${id} .title",{scale:1.25},{scale:1,duration:1.4,ease:"power2.out"},${at(S + 0.1)});`);
      } else {
        tl.push(
          `tl.fromTo("#${id} .wi",{yPercent:105,opacity:0},{yPercent:0,opacity:1,duration:0.5,ease:"power4.out",stagger:0.06},${at(S + 0.12)});`,
        );
      }
      let extra = "";
      if (s.kind === "solution") {
        extra = `<div class="badge"><span>${esc(c.emoji)}</span><b>${esc(c.name)}</b></div>`;
        tl.push(`tl.fromTo("#${id} .badge",{scale:0.6,opacity:0},{scale:1,opacity:1,duration:0.6,ease:"back.out(2)"},${at(S + 0.02)});`);
      }
      if (s.kind === "features" && s.bullets.length) {
        extra = `<ul class="bullets">${s.bullets
          .slice(0, 3)
          .map((b) => `<li><i>✓</i><span>${esc(b)}</span></li>`)
          .join("")}</ul>`;
        tl.push(
          `tl.fromTo("#${id} .bullets li",{x:${-60 * u},opacity:0},{x:0,opacity:1,duration:0.45,ease:"power3.out",stagger:0.22},${at(S + 0.45)});`,
        );
      }
      if (s.kind === "proof") {
        const m = s.title.match(/^([\d.,]+)\s*([kKmM]?)(.*)$/);
        if (m) {
          const target = parseFloat(m[1].replace(/,/g, ""));
          // 69584 → "69.6k".
          const big = target >= 10000 && !m[2];
          const fmt = big ? `(o.v/1000).toFixed(1)+"k"` : `o.v.toFixed(${m[1].includes(".") ? 1 : 0})`;
          tl.push(
            `(function(){var o={v:0},el=document.querySelector("#${id} .count");tl.to(o,{v:${target},duration:1.1,ease:"power2.out",onUpdate:function(){el.textContent=${fmt}}},${at(S + 0.15)});})();`,
          );
          return sceneSection(
            id,
            S,
            E,
            s,
            `<h1 class="title proof" style="font-size:${Math.round(titleSize * 1.35)}px"><span class="count">0</span>${esc(m[2])}<span class="unit">${esc(m[3])}</span></h1>`,
            "",
          );
        }
      }
      if (s.kind === "cta") {
        tl.push(`tl.fromTo("#${id} .logo",{scale:0,rotate:-20},{scale:1,rotate:0,duration:0.7,ease:"back.out(1.8)"},${at(S + 0.05)});`);
        tl.push(`tl.fromTo("#${id} .name",{y:${30 * u},opacity:0},{y:0,opacity:1,duration:0.5,ease:"power3.out"},${at(S + 0.3)});`);
        tl.push(`tl.fromTo("#${id} .pill",{y:${30 * u},opacity:0},{y:0,opacity:1,duration:0.5,ease:"power3.out"},${at(S + 0.55)});`);
        tl.push(`tl.to("#${id} .pill",{scale:1.06,duration:0.35,yoyo:true,repeat:3,ease:"sine.inOut"},${at(S + 1.2)});`);
        tl.push(`tl.fromTo("#${id} .url",{opacity:0},{opacity:0.7,duration:0.5},${at(S + 0.8)});`);
        const host = c.url.replace(/^https?:\/\/(www\.)?/, "");
        const cta = c.variants[0]?.cta ?? "Try it";
        return sceneSection(
          id,
          S,
          E,
          s,
          `<div class="logo">${esc(c.emoji)}</div>
           <div class="name" style="font-size:${fit(c.name, textW, 1, Math.round(130 * u), Math.round(60 * u))}px">${esc(c.name)}</div>
           <div class="pill">${esc(cta)} →</div>
           <div class="url">${esc(host)}</div>`,
          "cta",
        );
      }
      return sceneSection(
        id,
        S,
        E,
        s,
        `<h1 class="title" style="font-size:${titleSize}px">${splitWords(s.title, "")}</h1>${extra}`,
        s.kind,
      );
    })
    .join("\n");

  function sceneSection(id: string, S: number, E: number, s: Scene, body: string, kind: string) {
    return `<section id="${id}" class="clip scene ${kind}" data-start="${at(S)}" data-duration="${at(E - S)}" data-track-index="2">
      <div class="inner">${s.kicker && kind !== "cta" ? `<div class="kicker">${esc(s.kicker)}</div>` : ""}${body}</div>
    </section>`;
  }

  // ---- key visual: one long push-in, brightness follows the story ----
  if (assets.keyVisual) {
    tl.push(`tl.fromTo("#kv img",{scale:1.08,xPercent:-2},{scale:1.32,xPercent:2,duration:${duration},ease:"none"},0);`);
    script.scenes.forEach((s, i) => {
      tl.push(`tl.to("#kv",{opacity:${KV_OPACITY[s.kind]},duration:0.4,ease:"power1.inOut"},${at(Math.max(0, starts[i] - 0.1))});`);
    });
  }
  tl.push(`tl.fromTo("#blob1",{x:${-200 * u},y:${-100 * u}},{x:${260 * u},y:${380 * u},duration:${duration},ease:"sine.inOut"},0);`);
  tl.push(`tl.fromTo("#blob2",{x:${200 * u},y:${300 * u}},{x:${-240 * u},y:${-200 * u},duration:${duration},ease:"sine.inOut"},0);`);
  tl.push(`tl.fromTo("#bar",{scaleX:0},{scaleX:1,duration:${duration},ease:"none"},0);`);
  tl.push(`tl.fromTo("#brand",{opacity:0,y:${-20 * u}},{opacity:1,y:0,duration:0.4},${at(starts[1] ?? 1)});`);
  tl.push(`tl.to("#brand",{opacity:0,duration:0.3},${at(starts[n - 1])});`);
  // Flash on every cut.
  starts.slice(1).forEach((t) =>
    tl.push(`tl.fromTo("#flash",{opacity:0.22},{opacity:0,duration:0.35,ease:"power2.out",immediateRender:false},${at(t)});`),
  );

  // ---- captions ----
  const groups = captionGroups(vo.words);
  const capSize = Math.round((vertical ? 64 : 54) * u);
  const capHtml = groups
    .map((g, gi) => {
      const gStart = VO_DELAY + g[0].start;
      const gEnd = VO_DELAY + (groups[gi + 1] ? Math.min(groups[gi + 1][0].start, g[g.length - 1].end + 0.35) : g[g.length - 1].end + 0.4);
      tl.push(`tl.set("#c${gi}",{opacity:1},${at(gStart - 0.02)});`);
      tl.push(`tl.fromTo("#c${gi}",{scale:0.86},{scale:1,duration:0.18,ease:"back.out(3)"},${at(gStart - 0.02)});`);
      tl.push(`tl.set("#c${gi}",{opacity:0},${at(gEnd)});`);
      g.forEach((w, wi) => {
        tl.push(`tl.set("#c${gi}w${wi}",{color:"${accent}"},${at(VO_DELAY + w.start)});`);
        tl.push(`tl.set("#c${gi}w${wi}",{color:"${fg}"},${at(VO_DELAY + w.end + 0.05)});`);
      });
      return `<div class="cap" id="c${gi}">${g.map((w, wi) => `<span id="c${gi}w${wi}">${esc(w.text)}</span>`).join(" ")}</div>`;
    })
    .join("");

  // ---- audio ----
  const audio = [
    `<audio id="vo" src="${assets.vo}" data-start="${VO_DELAY}" data-volume="1"></audio>`,
    assets.music &&
      `<audio id="music" src="${assets.music}" data-start="0" data-duration="${duration}" data-volume="0.16" data-fade-in="0.3" data-fade-out="1.4"></audio>`,
    ...(assets.whoosh
      ? starts.slice(1, -1).map((t, i) => `<audio id="whoosh${i}" src="${assets.whoosh}" data-start="${at(Math.max(0, t - 0.2))}" data-volume="0.45"></audio>`)
      : []),
    assets.impact && `<audio id="impact" src="${assets.impact}" data-start="${at(starts[n - 1])}" data-volume="0.8"></audio>`,
  ]
    .filter(Boolean)
    .join("\n");

  const capTop = vertical ? Math.round(H - 640 * u) : Math.round(H - 210 * u);

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=${W}, height=${H}" />
<script src="gsap.min.js"></script>
<style>
*{box-sizing:border-box}
body{margin:0;background:${bg}}
#root{position:relative;width:${W}px;height:${H}px;overflow:hidden;background:${bg};color:${fg};font-family:"Inter",sans-serif}
.layer{position:absolute;inset:0}
#kv{opacity:0}
#kv img{width:100%;height:100%;object-fit:cover;transform-origin:50% 45%}
#shade{background:linear-gradient(180deg,${bg}cc 0%,${bg}33 30%,${bg}55 60%,${bg}f0 100%)}
.blob{position:absolute;width:${Math.round(900 * u)}px;height:${Math.round(900 * u)}px;border-radius:50%;filter:blur(${Math.round(140 * u)}px);opacity:.55}
#blob1{background:${accent};left:${Math.round(-200 * u)}px;top:${Math.round(-200 * u)}px}
#blob2{background:${accent};right:${Math.round(-300 * u)}px;bottom:${Math.round(200 * u)}px;opacity:.3}
#vignette{background:radial-gradient(ellipse at center,transparent 45%,rgba(0,0,0,.55) 100%)}
#flash{background:${fg};opacity:0}
#bar{position:absolute;left:0;top:0;height:${Math.round(8 * u)}px;width:100%;background:${accent};transform-origin:0 50%}
#brand{position:absolute;left:${pad}px;top:${Math.round((vertical ? 180 : 70) * u)}px;display:flex;gap:${Math.round(16 * u)}px;align-items:center;font-weight:700;font-size:${Math.round(38 * u)}px;opacity:0}
#brand span{display:grid;place-items:center;width:${Math.round(68 * u)}px;height:${Math.round(68 * u)}px;border-radius:${Math.round(18 * u)}px;background:${bg};box-shadow:inset 0 0 0 ${Math.max(2, Math.round(2 * u))}px ${accent}}
.scene{position:absolute;inset:0;display:flex;align-items:center;padding:0 ${pad}px}
.scene .inner{width:100%}
.kicker{display:inline-block;font-family:"JetBrains Mono",monospace;font-size:${Math.round(32 * u)}px;letter-spacing:.12em;text-transform:uppercase;color:${bg};background:${accent};padding:${Math.round(10 * u)}px ${Math.round(20 * u)}px;border-radius:${Math.round(10 * u)}px;margin-bottom:${Math.round(34 * u)}px}
.title{margin:0;font-weight:800;line-height:1.02;letter-spacing:-.035em;text-wrap:balance}
.w{display:inline-block;overflow:hidden;vertical-align:top;padding-bottom:.06em;margin-bottom:-.06em}
.wi{display:inline-block}
.hook .title{text-transform:none}
.badge{display:inline-flex;align-items:center;gap:${Math.round(20 * u)}px;margin-top:${Math.round(44 * u)}px;padding:${Math.round(18 * u)}px ${Math.round(30 * u)}px;border-radius:${Math.round(999)}px;background:${bg}e6;box-shadow:inset 0 0 0 ${Math.max(2, Math.round(3 * u))}px ${accent};font-size:${Math.round(46 * u)}px}
.badge b{font-weight:800}
.bullets{list-style:none;padding:0;margin:${Math.round(56 * u)}px 0 0;display:grid;gap:${Math.round(26 * u)}px}
.bullets li{display:flex;align-items:center;gap:${Math.round(24 * u)}px;font-size:${Math.round(54 * u)}px;font-weight:700}
.bullets i{font-style:normal;display:grid;place-items:center;width:${Math.round(64 * u)}px;height:${Math.round(64 * u)}px;border-radius:50%;background:${accent};color:${bg};font-size:${Math.round(36 * u)}px;flex:none}
.proof{font-variant-numeric:tabular-nums;color:${accent}}
.proof .unit{color:${fg};font-size:.4em;margin-left:.2em;letter-spacing:-.01em}
.cta .inner{display:flex;flex-direction:column;align-items:center;text-align:center}
.logo{display:grid;place-items:center;width:${Math.round(220 * u)}px;height:${Math.round(220 * u)}px;border-radius:${Math.round(56 * u)}px;background:${bg};box-shadow:0 0 ${Math.round(120 * u)}px ${accent}88,inset 0 0 0 ${Math.max(3, Math.round(4 * u))}px ${accent};font-size:${Math.round(130 * u)}px}
.name{font-weight:800;letter-spacing:-.04em;margin-top:${Math.round(44 * u)}px}
.pill{margin-top:${Math.round(40 * u)}px;background:${accent};color:${bg};font-weight:800;font-size:${Math.round(52 * u)}px;padding:${Math.round(26 * u)}px ${Math.round(56 * u)}px;border-radius:999px}
.url{margin-top:${Math.round(30 * u)}px;font-family:"JetBrains Mono",monospace;font-size:${Math.round(34 * u)}px;opacity:0}
#caps{position:absolute;left:${pad}px;right:${pad}px;top:${capTop}px;height:${Math.round(200 * u)}px}
.cap{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:0 .28em;opacity:0;font-weight:800;font-size:${capSize}px;color:${fg};text-shadow:0 ${Math.round(4 * u)}px ${Math.round(24 * u)}px rgba(0,0,0,.75);text-align:center;line-height:1.1}
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${duration}" data-fps="30" data-width="${W}" data-height="${H}">
  <div class="layer" id="bgl"><div class="blob" id="blob1"></div><div class="blob" id="blob2"></div></div>
  ${assets.keyVisual ? `<div class="layer" id="kv"><img src="${assets.keyVisual}" alt="" /></div>` : ""}
  <div class="layer" id="shade"></div>
  <div class="layer" id="vignette"></div>
  ${sceneHtml}
  <div id="caps">${capHtml}</div>
  <div id="brand"><span>${esc(c.emoji)}</span>${esc(c.name)}</div>
  <div id="bar"></div>
  <div class="layer" id="flash"></div>
  ${audio}
</div>
<script>
window.__timelines = window.__timelines || {};
var tl = gsap.timeline({ paused: true });
${tl.join("\n")}
window.__timelines.main = tl;
</script>
</body>
</html>`;
  return { html, duration };
}
