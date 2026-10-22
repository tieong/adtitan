import { z } from "zod";
import { trackEvents } from "@/lib/events";

const Body = z.object({
  events: z
    .array(
      z.object({
        type: z.enum(["impression", "click"]),
        campaignId: z.string().min(1).max(40),
        variant: z.number().int().min(0).max(9),
        sessionId: z.string().min(1).max(64),
        source: z.string().max(32).default("world"),
      }),
    )
    .max(200),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Bad events" }, { status: 400 });
  await trackEvents(parsed.data.events);
  return Response.json({ ok: true, n: parsed.data.events.length });
}
