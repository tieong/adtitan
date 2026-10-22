import { Nav } from "@/components/Nav";
import { Feed } from "./Feed";
import { videoAds } from "@/lib/feed";

export const dynamic = "force-dynamic";
export const metadata = { title: "Watch: AdCity" };

export default async function Page({ searchParams }: PageProps<"/watch">) {
  const { start } = await searchParams;
  const ads = await videoAds();
  return (
    <div data-theme="dark" className="lime min-h-dvh bg-page text-fg">
      <Nav />
      <Feed ads={ads} start={typeof start === "string" ? start : null} />
    </div>
  );
}
