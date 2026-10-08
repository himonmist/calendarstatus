import { handler } from "@/server/http";

export const GET = handler({}, async ({ c }) => {
  const list = await c.repos.programs.list(true);
  return { programs: list.map(p => ({
    id: p.id, slug: p.slug, title: p.title, shortDescription: p.shortDescription, fullDescription: p.fullDescription, durationMin: p.durationMin,
    formats: p.formats, minParticipants: p.minParticipants, maxParticipants: p.maxParticipants, priceText: p.priceText,
    objectives: p.objectives, audience: p.audience, modules: p.modules, bannerUrl: p.bannerUrl,
  })) };
});
