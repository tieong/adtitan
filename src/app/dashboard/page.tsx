import { Nav } from "@/components/Nav";
import { Dashboard } from "./Dashboard";

export const metadata = { title: "AdCity — analytics" };

export default function Page() {
  return (
    <div className="min-h-screen">
      <Nav />
      <Dashboard />
    </div>
  );
}
