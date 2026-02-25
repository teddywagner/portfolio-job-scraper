import type { Scraper, ScrapeResult, Job } from "./types";

interface LeverPosting {
  id: string;
  text: string;
  hostedUrl: string;
  categories: {
    location: string;
    commitment?: string;
  };
  createdAt?: number;
  salaryRange?: {
    min: number;
    max: number;
    currency: string;
    interval: string;
  };
}

export const leverScraper: Scraper = {
  name: "lever",

  canHandle(url: string): boolean {
    return url.includes("lever.co");
  },

  async scrape(company: string, url: string): Promise<ScrapeResult> {
    const slug = new URL(url).pathname.split("/").filter(Boolean)[0];
    const apiUrl = `https://api.lever.co/v0/postings/${slug}?mode=json`;
    const resp = await fetch(apiUrl);

    if (!resp.ok) {
      return {
        company,
        jobs: [],
        scrapedAt: new Date().toISOString(),
        source: "lever",
        error: `Lever API returned ${resp.status}`,
      };
    }

    const data = (await resp.json()) as LeverPosting[];

    const jobs: Job[] = data.map((p) => ({
      company,
      title: p.text,
      url: p.hostedUrl,
      location: p.categories?.location ?? "Not specified",
      publishedAt: p.createdAt ? new Date(p.createdAt).toISOString() : undefined,
      compensation: p.salaryRange
        ? {
            min: p.salaryRange.min,
            max: p.salaryRange.max,
            currency: p.salaryRange.currency,
            interval: p.salaryRange.interval,
          }
        : undefined,
      externalId: p.id,
    }));

    return { company, jobs, scrapedAt: new Date().toISOString(), source: "lever" };
  },
};
