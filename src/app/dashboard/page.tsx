import { Nav } from "@/components/Nav";
import { Dashboard } from "./Dashboard";

export const metadata = { title: "Analytics: AdCity" };

export default function Page() {
  return (
    <div className="min-h-dvh bg-page text-fg">
      <Nav primaryCreate />
      <Dashboard />
    </div>
  );
}
