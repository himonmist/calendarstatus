import Link from "next/link";

export function SiteHeader() {
  const links = [["/#programs", "Training Programs"], ["/book-training", "Availability"], ["/#about", "About"], ["/#how-it-works", "How It Works"], ["/#contact", "Contact"]];
  return (
    <header className="sticky top-0 z-30 border-b border-ink-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="font-semibold tracking-tight">Hasan Mahfuz <span className="text-brand">· AI Training</span></Link>
        <nav aria-label="Primary" className="hidden items-center gap-6 text-sm text-ink-700 md:flex">
          {links.map(([h, l]) => <Link key={h} href={h} className="hover:text-ink-950">{l}</Link>)}
        </nav>
        <Link href="/book-training" className="btn-brand">Book Training</Link>
      </div>
    </header>
  );
}
