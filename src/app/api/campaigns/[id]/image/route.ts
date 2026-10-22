import { getCampaign, getImage, saveImage } from "@/lib/db";
import { paintAd } from "@/lib/generate";

export const maxDuration = 120;

export async function GET(_req: Request, ctx: RouteContext<"/api/campaigns/[id]/image">) {
  const { id } = await ctx.params;
  const img = await getImage(id);
  if (!img) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(img.data), {
    headers: { "content-type": img.mime, "cache-control": "public, max-age=300" },
  });
}

// Repaint the key visual (used by the "new visual" button and the seed script).
export async function POST(_req: Request, ctx: RouteContext<"/api/campaigns/[id]/image">) {
  const { id } = await ctx.params;
  const c = await getCampaign(id);
  if (!c) return Response.json({ error: "Not found" }, { status: 404 });
  const img = await paintAd(c);
  await saveImage(id, img.data, img.mime);
  return Response.json({ ok: true });
}
