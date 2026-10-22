"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/lime/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/lime/ui/field";
import { Input } from "@/components/lime/ui/input";
import { List, ListItem } from "@/components/lime/ui/list";
import { Status } from "@/components/lime/ui/status";

type Step = "fetch" | "understand" | "write" | "done";
const STEPS: { key: Step; label: string }[] = [
  { key: "fetch", label: "Reading your project" },
  { key: "understand", label: "Working out what it does" },
  { key: "write", label: "Writing three billboard ads" },
  { key: "done", label: "Opening your studio" },
];

const EXAMPLES = [
  { label: "HyperFrames", url: "github.com/heygen-com/hyperframes" },
  { label: "Excalidraw", url: "github.com/excalidraw/excalidraw" },
  { label: "Lightdash", url: "lightdash.com" },
];

export function Generator() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<Step | null>(null);
  const [detail, setDetail] = useState<Partial<Record<Step, string>>>({});
  const [error, setError] = useState<string | null>(null);

  async function run(input: string) {
    if (!input.trim() || busy) return;
    setBusy(true);
    setError(null);
    setStep("fetch");
    setDetail({});
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: input }),
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
          if (msg.step === "understand") {
            setStep("understand");
            setDetail((d) => ({ ...d, fetch: msg.title }));
          }
          if (msg.step === "write") {
            setStep("write");
            setDetail((d) => ({ ...d, understand: msg.headline }));
          }
          if (msg.step === "done") {
            setStep("done");
            // The studio picks up from here and starts the video; the image keeps painting server-side.
            router.push(`/c/${msg.campaign.id}${msg.cached ? "" : "?new=1"}`);
            return;
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStep(null);
      setBusy(false);
    }
  }

  const idx = step ? STEPS.findIndex((s) => s.key === step) : -1;

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(url);
        }}
        className="flex max-w-md flex-col gap-4"
      >
        <Field name="url" invalid={!!error}>
          <FieldLabel>Project link</FieldLabel>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="github.com/you/your-hack"
            autoComplete="url"
            spellCheck={false}
            size="lg"
          />
          <FieldDescription>A GitHub repository or a public website.</FieldDescription>
          {error && <FieldError match>{error}</FieldError>}
        </Field>
        <Button type="submit" size="lg" pending={busy} className="w-full sm:w-auto sm:self-start">
          Make my ad
        </Button>
      </form>

      {!step && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-fg-2">Or try</span>
          {EXAMPLES.map((ex) => (
            <Button
              key={ex.url}
              variant="outline"
              size="sm"
              onClick={() => {
                setUrl(ex.url);
                run(ex.url);
              }}
            >
              {ex.label}
            </Button>
          ))}
        </div>
      )}

      {step && (
        <List variant="grouped" aria-live="polite">
          {STEPS.map((s, i) => (
            <ListItem
              key={s.key}
              title={s.label}
              description={detail[s.key]}
              trailing={
                i < idx ? (
                  <Status status="done" label="Done" />
                ) : i === idx ? (
                  <Status status="running" label="Working" />
                ) : (
                  <Status status="queued" label="Next" />
                )
              }
            />
          ))}
        </List>
      )}
    </div>
  );
}
