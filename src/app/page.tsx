import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { getContainer } from "@/server/container";

export const dynamic = "force-dynamic";

const STEPS = [
  ["1", "Choose Your Training", "Select an AI training program suitable for your organization."],
  ["2", "Check Availability", "View real-time available dates and times."],
  ["3", "Book a Slot", "Submit your organization and training requirements."],
  ["4", "Confirmation", "Receive confirmation and a calendar invitation."],
];
const EXPERTISE = ["Generative AI & AI Agents", "Pharma & Healthcare AI", "Data Analytics", "Software Architecture", "AI Leadership", "Technology Consulting"];

export default async function Home() {
  const c = getContainer();
  const programs = await c.repos.programs.list(true);
  const site = c.env.siteUrl;
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Person", name: "Md Hasan Mahfuz", jobTitle: "Managing Director & CTO | AI Trainer | Technology Consultant", url: site, knowsAbout: EXPERTISE },
      { "@type": "ProfessionalService", name: "Md Hasan Mahfuz — AI Training & Consulting", url: site, areaServed: "Worldwide" },
      ...programs.map(p => ({ "@type": "Course", name: p.title, description: p.shortDescription, provider: { "@type": "Person", name: "Md Hasan Mahfuz" },
        hasCourseInstance: { "@type": "CourseInstance", courseMode: p.formats.map(f => (f === "onsite" ? "onsite" : f === "online" ? "online" : "blended")) } })),
    ],
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      <SiteHeader />
      <main>
        <section className="bg-ink-950 text-white">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-[1.2fr_.8fr] md:py-24">
            <div>
              <p className="text-sm font-medium text-teal-300">AI Training · Workshops · Consulting</p>
              <h1 className="mt-3 text-4xl font-semibold leading-tight tracking-tight md:text-5xl">Bring practical AI to your organization.</h1>
              <p className="mt-5 max-w-xl text-lg text-ink-300">Corporate AI training for pharmaceutical, healthcare, government and enterprise teams — delivered by Md Hasan Mahfuz. See live availability and book your session in minutes.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/book-training" className="btn bg-white text-ink-950 hover:bg-ink-100">Check Availability &amp; Book Training</Link>
                <Link href="/custom-request" className="btn border border-white/30 text-white hover:bg-white/10">Request a Custom Program</Link>
              </div>
            </div>
            <div className="card self-center bg-white/5 p-6 text-white ring-1 ring-white/10 shadow-none">
              <p className="text-sm text-ink-300">Md Hasan Mahfuz</p>
              <p className="mt-1 font-semibold">Managing Director &amp; CTO · AI Trainer · Technology Consultant</p>
              <ul className="mt-4 flex flex-wrap gap-2">{EXPERTISE.map(e => <li key={e} className="rounded-full bg-white/10 px-3 py-1 text-xs">{e}</li>)}</ul>
            </div>
          </div>
        </section>

        <section id="programs" className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-2xl font-semibold tracking-tight">Training programs</h2>
          <p className="mt-2 text-ink-500">Choose a ready-made program or request one built around your team.</p>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {programs.map(p => (
              <article key={p.id} className="card flex flex-col p-6">
                <h3 className="font-semibold">{p.title}</h3>
                <p className="mt-2 flex-1 text-sm text-ink-500">{p.shortDescription}</p>
                <dl className="mt-4 space-y-1 text-xs text-ink-700">
                  <div className="flex justify-between"><dt>Duration</dt><dd className="font-medium">{p.durationMin >= 480 ? "1 day" : `${p.durationMin / 60} hours`}</dd></div>
                  <div className="flex justify-between"><dt>Format</dt><dd className="font-medium capitalize">{p.formats.join(" / ")}</dd></div>
                  {p.audience && <div className="flex justify-between gap-4"><dt>Audience</dt><dd className="text-right font-medium">{p.audience}</dd></div>}
                </dl>
                <Link href={`/book-training?program=${encodeURIComponent(p.id)}`} className="btn-primary mt-5">Book This Program</Link>
              </article>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="border-y border-ink-100 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
            <ol className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map(([n, t, d]) => (
                <li key={n} className="rounded-2xl bg-ink-50 p-5"><span className="grid h-8 w-8 place-items-center rounded-full bg-brand text-sm font-semibold text-white">{n}</span>
                  <h3 className="mt-3 font-semibold">{t}</h3><p className="mt-1 text-sm text-ink-500">{d}</p></li>
              ))}
            </ol>
          </div>
        </section>

        <section id="about" className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-2xl font-semibold tracking-tight">About</h2>
          <p className="mt-3 max-w-3xl text-ink-700">Md Hasan Mahfuz helps organizations adopt AI responsibly and productively — from pharmaceutical sales teams and medical professionals to procurement, compliance and leadership groups. Sessions are practical, tailored to your industry, and available online, on-site or hybrid.</p>
        </section>

        <section id="contact" className="bg-ink-950 text-white">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-14 md:flex-row md:items-center">
            <div><h2 className="text-2xl font-semibold">Ready to schedule?</h2><p className="mt-1 text-ink-300">Pick a date that works — your booking is protected against conflicts automatically.</p></div>
            <div className="flex gap-3"><Link href="/book-training" className="btn bg-white text-ink-950">Check Availability</Link><Link href="/manage" className="btn border border-white/30 text-white">Manage a Booking</Link></div>
          </div>
        </section>
      </main>
      <footer className="px-4 py-8 text-center text-xs text-ink-500">© {new Date().getFullYear()} Md Hasan Mahfuz. We store only what is needed to deliver your booking and never share it.</footer>
    </>
  );
}
