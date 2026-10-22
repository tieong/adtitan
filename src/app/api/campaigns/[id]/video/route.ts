import { z } from "zod";
import { getCampaign } from "@/lib/db";
import { startVideo } from "@/lib/video/pipeline";
import { jobsFor } from "@/lib/video/store";

export async function GET(_req: Request, ctx: RouteContext<"/api/campaigns/[id]/video">) {
  const { id } = await ctx.params;
  return Response.json(await jobsFor(id));
}

const Body = z.object({ format: z.enum(["vertical", "landscape"]).default("vertical") });

export async function POST(req: Request, ctx: RouteContext<"/api/campaigns/[id]/video">) {
  const { id } = await ctx.params;
  if (!(await getCampaign(id))) return Response.json({ error: "Not found" }, { status: 404 });
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "Bad format" }, { status: 400 });
  return Response.json(await startVideo(id, parsed.data.format), { status: 202 });
}
