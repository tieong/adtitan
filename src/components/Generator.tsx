"use client";

import { useState } from "react";
import Link from "next/link";
import type { Campaign } from "@/lib/types";
import { AdCard } from "./AdCard";

type Step = "fetch" | "understand" | "write" | "done";
const STEPS: { key: Step; label: string }[] = [
  { key: "fetch", label: "Reading your project" },
  { key: "understand", label: "Understanding what it does" },
  { key: "write", label: "Writing 3 ad variants" },
  { key: "done", label: "Booking a billboard in the city" },
];

const EXAMPLES = ["github.com/heygen-com/hyperframes", "github.com/aiven/aiven-client", "lightdash.com"];

export function Generator() {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<Step | null>(null);
  const [detail, setDetail] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [variant, setVariant] = useState(0);

  async function run(input: string, force = false) {
    if (!input.trim() || busy) return;
    setBusy(true);
    setError(null);
    setCampaign(null);
    setVariant(0);
    setStep("fetch");
    setDetail("");
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: input, force }),
      });
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => null))?.error ?? `HTTP ${res.status}`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const msg = JSON.parse(buf.slice(0, nl));
          buf = buf.slice(nl + 1);
          if (msg.step === "error") throw new Error(msg.error);
          // Each message announces a step that just finished; light up the next one.
          if (msg.step === "fetch") setStep("fetch");
          if (msg.step === "understand") {
            setStep("understand");
            setDetail(msg.title);
          }
          if (msg.step === "write") {
            setStep("write");
            setDetail(`“${msg.headline}”`);
          }
          if (msg.step === "done") {
            setStep("done");
            setCampaign(msg.campaign);
            setBusy(false);
          }
          if (msg.step === "image") setCampaign(msg.campaign);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStep(null);
    } finally {
      setBusy(false);
    }
  }

  const stepIdx = step ? STEPS.findIndex((s) => s.key === step) : -1;

  return (
    <div className="w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(url);
        }}
        className="group relative flex items-center rounded-2xl border border-white/10 bg-white/[0.03] p-1.5 shadow-[0_0_80px_-20px_#7cf7ff55] transition focus-within:border-[#7cf7ff]/50"
      >
        <span className="pl-4 font-mono text-sm text-white/35">↳</span>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="github.com/you/your-hack  or  your-project.com"
          className="min-w-0 flex-1 bg-transparent px-3 py-3 text-[15px] outline-none placeholder:text-white/30"
          autoFocus
          spellCheck={false}
        />
        <button
          disabled={busy || !url.trim()}
          className="rounded-xl bg-[#7cf7ff] px-5 py-3 text-sm font-semibold text-black transition hover:bg-white disabled:opacity-40"
        >
          {busy ? "Generating…" : "Generate my ad"}
        </button>
      </form>

      {!step && !campaign && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/40">
          Try
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => {
                setUrl(ex);
                run(ex);
              }}
              className="rounded-full border border-white/10 px-2.5 py-1 font-mono text-white/55 hover:border-white/30 hover:text-white"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {error && <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>}

      {step && !campaign && (
        <ol className="mt-6 space-y-2.5">
          {STEPS.map((s, i) => (
            <li key={s.key} className={`flex items-center gap-3 text-sm ${i <= stepIdx ? "text-white" : "text-white/30"}`}>
              <span
                className={`grid size-5 place-items-center rounded-full border text-[10px] ${
                  i < stepIdx ? "border-[#8cff7a] bg-[#8cff7a] text-black" : i === stepIdx ? "border-[#7cf7ff]" : "border-white/15"
                }`}
              >
                {i < stepIdx ? "✓" : i === stepIdx ? <span className="size-1.5 animate-ping rounded-full bg-[#7cf7ff]" /> : ""}
              </span>
              {s.label}
              {i === stepIdx - 1 && detail && <span className="truncate font-mono text-xs text-white/40">{detail}</span>}
            </li>
          ))}
        </ol>
      )}

      {campaign && (
        <div className="mt-8">
          <AdCard campaign={campaign} variant={variant} className="ring-1 ring-white/10" />
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl border border-white/10 p-1">
              {campaign.variants.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setVariant(i)}
                  className={`rounded-lg px-3 py-1.5 font-mono text-xs ${variant === i ? "bg-white text-black" : "text-white/55 hover:text-white"}`}
                >
                  Variant {"ABC"[i]}
                </button>
              ))}
            </div>
            {!campaign.hasImage && (
              <span className="flex items-center gap-2 font-mono text-xs text-white/40">
                <span className="size-1.5 animate-pulse rounded-full bg-[#ffd166]" /> painting the key visual…
              </span>
            )}
            <div className="ml-auto flex gap-2">
              <button
                onClick={() => run(campaign.url, true)}
                className="rounded-xl px-3 py-2 text-sm text-white/55 hover:text-white"
              >
                Regenerate
              </button>
              <Link href={`/c/${campaign.id}`} className="rounded-xl border border-white/15 px-4 py-2 text-sm hover:bg-white/5">
                Analytics
              </Link>
              <Link
                href={`/world?focus=${campaign.id}`}
                className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-[#7cf7ff]"
              >
                See it in the city →
              </Link>
            </div>
          </div>
          <p className="mt-4 text-sm text-white/50">{campaign.description}</p>
        </div>
      )}
    </div>
  );
}
