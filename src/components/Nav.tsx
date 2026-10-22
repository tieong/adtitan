import Link from "next/link";

export function Nav() {
  return (
    <header className="sticky top-0 z-20 border-b border-white/5 bg-[#05060a]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-5">
        <Link href="/" className="text-[15px] font-semibold tracking-tight">
          Ad<span className="text-[#7cf7ff]">City</span>
        </Link>
        <nav className="flex gap-5 text-sm text-white/55">
          <Link href="/" className="hover:text-white">Generate</Link>
          <Link href="/dashboard" className="hover:text-white">Analytics</Link>
        </nav>
        <Link
          href="/world"
          className="ml-auto rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-black transition hover:bg-[#7cf7ff]"
        >
          Enter the city →
        </Link>
      </div>
    </header>
  );
}
