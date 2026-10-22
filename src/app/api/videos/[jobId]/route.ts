import { getJob } from "@/lib/video/store";

export async function GET(_req: Request, ctx: RouteContext<"/api/videos/[jobId]">) {
  const job = await getJob((await ctx.params).jobId);
  return job ? Response.json(job) : Response.json({ error: "Not found" }, { status: 404 });
}
