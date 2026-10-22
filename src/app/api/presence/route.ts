import { z } from "zod";
import { upsertPlayer } from "@/lib/presence";

const Body = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(24),
  color: z.string().max(16),
  x: z.number().finite(),
  z: z.number().finite(),
  ry: z.number().finite(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Bad player" }, { status: 400 });
  const players = await upsertPlayer({ ...parsed.data, t: Date.now() });
  return Response.json({ players: players.filter((p) => p.id !== parsed.data.id) });
}
