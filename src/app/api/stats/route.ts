import { listCampaigns } from "@/lib/db";
import { allTotals } from "@/lib/events";
import { playerCount } from "@/lib/presence";

export async function GET() {
  const [campaigns, totals, players] = await Promise.all([listCampaigns(), allTotals(), playerCount()]);
  let impressions = 0;
  let clicks = 0;
  let visits = 0;
  for (const t of totals.values()) {
    impressions += t.impressions;
    clicks += t.clicks;
    visits += t.visits;
  }
  return Response.json({
    campaigns: campaigns.length,
    impressions,
    clicks,
    visits,
    ctr: impressions ? clicks / impressions : 0,
    players,
  });
}
