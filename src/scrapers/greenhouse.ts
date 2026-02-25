import type { Scraper, ScrapeResult, Job } from "./types";

interface GreenhouseJob {
  id: number;
  title: string;
  absolute_url: string;
  location: { name: string };
  first_published?: string;
}

export const greenhouseScraper: Scraper = {
  name: "greenhouse",

  canHandle(url: string): boolean {
    return url.includes("greenhouse.io");
  },

  async scrape(company: string, url: string): Promise<ScrapeResult> {
    const board = new URL(url).pathname.split("/").filter(Boolean)[0];
    const apiUrl = `https://boards-api.greenhouse.io/v1/boards/${board}/jobs`;
    const resp = await fetch(apiUrl);

    if (!resp.ok) {
      return {
        company,
        jobs: [],
        scrapedAt: new Date().toISOString(),
        source: "greenhouse",
        error: `Greenhouse API returned ${resp.status}`,
      };
    }

    const data = (await resp.json()) as { jobs: GreenhouseJob[] };

    const jobs: Job[] = data.jobs.map((j) => ({
      company,
      title: j.title,
      url: j.absolute_url,
      location: j.location?.name ?? "Not specified",
      publishedAt: j.first_published,
      externalId: String(j.id),
    }));

    return { company, jobs, scrapedAt: new Date().toISOString(), source: "greenhouse" };
  },
};
