import { videoAds } from "@/lib/feed";

export async function GET() {
  return Response.json(await videoAds());
}
