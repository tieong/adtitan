import { getVideo } from "@/lib/video/store";

// Serves the MP4 with Range support so <video> can seek.
export async function GET(req: Request, ctx: RouteContext<"/api/videos/[jobId]/file">) {
  const { jobId } = await ctx.params;
  const buf = await getVideo(jobId);
  if (!buf) return new Response(null, { status: 404 });
  const headers: Record<string, string> = {
    "content-type": "video/mp4",
    "accept-ranges": "bytes",
    "cache-control": "public, max-age=3600",
  };
  if (new URL(req.url).searchParams.has("download")) headers["content-disposition"] = `attachment; filename="adcity-${jobId}.mp4"`;
  const range = req.headers.get("range")?.match(/bytes=(\d*)-(\d*)/);
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Math.min(Number(range[2]), buf.length - 1) : buf.length - 1;
    return new Response(new Uint8Array(buf.subarray(start, end + 1)), {
      status: 206,
      headers: { ...headers, "content-range": `bytes ${start}-${end}/${buf.length}`, "content-length": String(end - start + 1) },
    });
  }
  return new Response(new Uint8Array(buf), { headers: { ...headers, "content-length": String(buf.length) } });
}
