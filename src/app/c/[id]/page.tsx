import { notFound } from "next/navigation";
import { getCampaign } from "@/lib/db";
import { Nav } from "@/components/Nav";
import { CampaignView } from "./CampaignView";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/c/[id]">) {
  const c = await getCampaign((await params).id);
  return { title: c ? `${c.name} — AdCity campaign` : "AdCity" };
}

export default async function Page({ params }: PageProps<"/c/[id]">) {
  const c = await getCampaign((await params).id);
  if (!c) notFound();
  return (
    <div className="min-h-screen">
      <Nav />
      <CampaignView initial={c} />
    </div>
  );
}
