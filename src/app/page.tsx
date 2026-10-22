import { Nav } from "@/components/Nav";
import { Generator } from "@/components/Generator";
import { LiveNumbers } from "@/components/LiveNumbers";
import { Reel } from "@/components/Reel";
import { RotatingWord } from "@/components/RotatingWord";
import { List, ListItem, ListIcon } from "@/components/lime/ui/list";
import { LinkButton } from "@/components/LinkButton";
import { ChartLine, Edit, Search, VolumeUp, Video } from "@/components/lime/icon";
import { listCampaigns } from "@/lib/db";
import { allTotals } from "@/lib/events";
import { videoAds } from "@/lib/feed";
import { playerCount } from "@/lib/presence";

export const dynamic = "force-dynamic";

const STEPS = [
  { icon: Search, title: "Reads your project", description: "The README of your repo, or the text of your landing page." },
  { icon: Edit, title: "Writes the ads", description: "Three billboard variants and a scene by scene video script, by OpenAI." },
  { icon: VolumeUp, title: "Records the voice and the music", description: "An ElevenLabs voiceover with synced captions, a score and sound effects." },
  { icon: Video, title: "Renders the video", description: "HyperFrames turns the motion design into an MP4 in about a minute." },
  { icon: ChartLine, title: "Shows it and keeps score", description: "Every view and click lands in ClickHouse; the variant people click wins." },
];

export default async function Home() {
  const [campaigns, totals, ads, players] = await Promise.all([
    listCampaigns().catch(() => []),
    allTotals().catch(() => new Map()),
    videoAds().catch(() => []),
    playerCount().catch(() => 0),
  ]);
  let impressions = 0;
  let clicks = 0;
  let visits = 0;
  for (const t of totals.values()) {
    impressions += t.impressions;
    clicks += t.clicks;
    visits += t.visits;
  }

  return (
    <div className="min-h-dvh bg-page text-fg">
      <Nav />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-16 px-4 pt-10 pb-16 sm:px-6 sm:pt-20">
        <section className="flex max-w-2xl flex-col gap-6">
          <h1 className="text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
            {/* The rotating word ends its own line, so changing it never reflows the headline. */}
            <span className="block">
              Turn your{" "}
              <RotatingWord
                words={["hackathon", "B2B SaaS", "side", "open source", "indie", "AI", "mobile app", "weekend"]}
              />
            </span>
            <span className="block">project into a video ad</span>
          </h1>
          <p className="text-base text-fg-2">
            Paste a GitHub repo or a website. AdCity writes three billboard ads and a 20 second video with a voiceover
            and music, then shows it to everyone else at the hackathon.
          </p>
          <Generator />
          <LiveNumbers initial={{ campaigns: campaigns.length, impressions, clicks, visits, players }} />
        </section>

        {ads.length > 0 && (
          <section className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-lg font-semibold">Made at the hackathon</h2>
              <LinkButton href="/watch" variant="link">
                Watch them all
              </LinkButton>
            </div>
            <Reel ads={ads.map((a) => ({ campaign: a.campaign, videoId: a.videoId }))} />
          </section>
        )}

        <section className="flex max-w-2xl flex-col gap-3">
          <h2 className="text-lg font-semibold">What happens when you paste a link</h2>
          <List>
            {STEPS.map((s) => (
              <ListItem key={s.title} leading={<ListIcon icon={s.icon} />} title={s.title} description={s.description} />
            ))}
          </List>
        </section>
      </main>
      <footer className="border-t border-line">
        <p className="mx-auto w-full max-w-5xl px-4 py-6 text-sm text-fg-2 sm:px-6">
          Built at the hackathon on Aiven PostgreSQL, ClickHouse and Valkey, with OpenAI, ElevenLabs and HyperFrames.
        </p>
      </footer>
    </div>
  );
}
