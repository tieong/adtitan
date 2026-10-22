import { nanoid } from "nanoid";
import { z } from "zod";
import { getCampaignByUrl, listCampaigns, saveCampaign, saveImage } from "@/lib/db";
import { allTotals } from "@/lib/events";
import { ingest, normalizeUrl } from "@/lib/ingest";
import { paintAd, writeAd } from "@/lib/generate";

export const maxDuration = 120;

export async function GET() {
  const [campaigns, totals] = await Promise.all([listCampaigns(), allTotals()]);
  return Response.json(
    campaigns.map((c) => {
      const t = totals.get(c.id) ?? { impressions: 0, clicks: 0, visits: 0, uniqueViewers: 0 };
      return { ...c, stats: { ...t, ctr: t.impressions ? t.clicks / t.impressions : 0 } };
    }),
  );
}

const Body = z.object({ url: z.string().min(3).max(500), force: z.boolean().optional() });

// Streams NDJSON progress lines so the UI can show each step as it happens.
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Send { url }" }, { status: 400 });

  let url: string;
  try {
    url = normalizeUrl(parsed.data.url);
  } catch {
    return Response.json({ error: "That doesn't look like a URL" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // The client may leave mid-stream; keep working so the campaign still completes.
      const send = (o: object) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(o) + "\n"));
        } catch {}
      };
      try {
        if (!parsed.data.force) {
          const existing = await getCampaignByUrl(url);
          if (existing) {
            send({ step: "done", campaign: existing, cached: true });
            controller.close();
            return;
          }
        }
        send({ step: "fetch", url });
        const src = await ingest(url);
        send({ step: "understand", title: src.title, chars: src.text.length });
        const copy = await writeAd(src);
        send({ step: "write", headline: copy.variants[0]?.headline });
        const campaign = await saveCampaign({
          id: nanoid(10),
          url,
          kind: src.kind,
          name: copy.name,
          description: copy.description,
          category: copy.category,
          emoji: copy.emoji,
          palette: copy.palette,
          variants: copy.variants.slice(0, 3),
          imagePrompt: copy.imagePrompt,
          meta: src.meta,
        });
        send({ step: "done", campaign });
        // The key visual takes ~10s; the billboard shows a typographic version until it lands.
        try {
          const img = await paintAd(copy);
          await saveImage(campaign.id, img.data, img.mime);
          send({ step: "image", campaign: { ...campaign, hasImage: true } });
        } catch (e) {
          console.error("image generation failed", campaign.id, e);
        }
      } catch (e) {
        console.error("generation failed", url, e);
        send({ step: "error", error: e instanceof Error ? e.message : String(e) });
      }
      try {
        controller.close();
      } catch {}
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8" } });
}
