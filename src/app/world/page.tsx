import { WorldLoader } from "./WorldLoader";

export const metadata = { title: "AdCity — the city" };

export default async function Page({ searchParams }: PageProps<"/world">) {
  const { focus } = await searchParams;
  return <WorldLoader focusId={typeof focus === "string" ? focus : null} />;
}
