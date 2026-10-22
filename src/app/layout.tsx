import type { Metadata } from "next";
import "@/components/lime/styles.css";
import "./globals.css";
import { LimePortalProvider } from "@/lib/lime/portal";
import { ToastProvider } from "@/components/lime/ui/toast";

export const metadata: Metadata = {
  title: "AdCity: turn your project into a video ad",
  description:
    "Paste a GitHub repo or a website. AdCity writes the ad, records the voiceover, scores it and renders a video other hackers watch.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="lime">
        <LimePortalProvider>
          <ToastProvider>{children}</ToastProvider>
        </LimePortalProvider>
      </body>
    </html>
  );
}
