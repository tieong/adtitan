import { deleteCampaign, getCampaign } from "@/lib/db";
import { campaignStats, deleteEvents } from "@/lib/events";

export async function GET(_req: Request, ctx: RouteContext<"/api/campaigns/[id]">) {
  const { id } = await ctx.params;
  const campaign = await getCampaign(id);
  if (!campaign) return Response.json({ error: "Not found" }, { status: 404 });
  const stats = await campaignStats(id, campaign.variants.length);
  return Response.json({ campaign, stats });
}

export async function DELETE(req: Request, ctx: RouteContext<"/api/campaigns/[id]">) {
  if (!process.env.ADMIN_KEY || req.headers.get("x-admin-key") !== process.env.ADMIN_KEY) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  await Promise.all([deleteCampaign(id), deleteEvents(id)]);
  return new Response(null, { status: 204 });
}
