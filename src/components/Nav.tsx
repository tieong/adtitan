"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { buttonVariants } from "@/components/lime/ui/button";
import { cn } from "@/lib/lime/utils";

const LINKS = [
  { href: "/watch", label: "Watch" },
  { href: "/dashboard", label: "Analytics" },
  { href: "/world", label: "City" },
];

/**
 * Sticky header; gains its bottom edge once content scrolls under it.
 * primaryCreate: the page has no main action of its own, so "Make an ad" carries the glow.
 */
export function Nav({ showCreate = true, primaryCreate = false }: { showCreate?: boolean; primaryCreate?: boolean }) {
  const path = usePathname();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 4);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <header className={cn("sticky top-0 z-10 bg-page", scrolled && "border-b border-line")}>
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-1 px-4 sm:px-6">
        <Link href="/" className="me-3 text-base font-semibold tracking-tight">
          AdCity
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={path === l.href ? "page" : undefined}
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                path === l.href ? "text-fg" : "text-fg-2",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        {showCreate && path !== "/" && (
          <Link href="/" className={cn(buttonVariants({ variant: primaryCreate ? "primary" : "secondary", size: "sm" }), "ms-auto")}>
            Make an ad
          </Link>
        )}
      </div>
    </header>
  );
}
