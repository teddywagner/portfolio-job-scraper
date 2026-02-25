import type { Scraper, ScrapeResult, Job } from "./types";

interface AshbyApiJob {
  id: string;
  title: string;
  location: string;
  jobUrl: string;
  isListed: boolean;
  publishedAt?: string;
}

export const ashbyScraper: Scraper = {
  name: "ashby",

  canHandle(url: string): boolean {
    return url.includes("jobs.ashbyhq.com");
  },

  async scrape(company: string, url: string): Promise<ScrapeResult> {
    const org = new URL(url).pathname.split("/").filter(Boolean)[0];
    const apiUrl = `https://api.ashbyhq.com/posting-api/job-board/${org}`;
    const resp = await fetch(apiUrl);

    if (!resp.ok) {
      return {
        company,
        jobs: [],
        scrapedAt: new Date().toISOString(),
        source: "ashby",
        error: `Ashby API returned ${resp.status}`,
      };
    }

    const data = (await resp.json()) as { jobs: AshbyApiJob[] };

    const jobs: Job[] = data.jobs
      .filter((j) => j.isListed)
      .map((j) => ({
        company,
        title: j.title,
        url: j.jobUrl,
        location: j.location ?? "Not specified",
        publishedAt: j.publishedAt,
        externalId: j.id,
      }));

    return { company, jobs, scrapedAt: new Date().toISOString(), source: "ashby" };
  },
};
