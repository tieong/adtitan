import { getCampaign } from "@/lib/db";
import { trackEvents } from "@/lib/events";

// Tracked outbound link: every visit to a project goes through here.
export async function GET(req: Request, ctx: RouteContext<"/r/[id]">) {
  const { id } = await ctx.params;
  const campaign = await getCampaign(id);
  if (!campaign) return Response.redirect(new URL("/", req.url), 302);
  const q = new URL(req.url).searchParams;
  const variant = Math.min(Math.max(Number(q.get("v") ?? 0) || 0, 0), campaign.variants.length - 1);
  try {
    await trackEvents([
      {
        type: "visit",
        campaignId: id,
        variant,
        sessionId: (q.get("s") ?? "anon").slice(0, 64),
        source: (q.get("src") ?? "link").slice(0, 32),
      },
    ]);
  } catch (e) {
    console.error("visit tracking failed", e);
  }
  return Response.redirect(campaign.url, 302);
}
