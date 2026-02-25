import FirecrawlApp from "@mendable/firecrawl-js";
import { z } from "zod";
import type { Scraper, ScrapeResult, Job } from "./types";
import { getConfig } from "../config";

const JobListSchema = z.object({
  jobs: z.array(
    z.object({
      title: z.string().describe("The job title"),
      url: z.string().describe("Direct URL to the job posting. Use absolute URLs."),
      location: z
        .string()
        .describe("Job location or 'Not specified' if not listed"),
    })
  ),
});

export const firecrawlScraper: Scraper = {
  name: "firecrawl",

  canHandle(_url: string): boolean {
    return true; // catch-all
  },

  async scrape(company: string, url: string): Promise<ScrapeResult> {
    const config = getConfig();

    if (!config.firecrawlApiKey || config.firecrawlApiKey === "fc-your-api-key-here") {
      return {
        company,
        jobs: [],
        scrapedAt: new Date().toISOString(),
        source: "firecrawl",
        error: "FIRECRAWL_API_KEY not set — skipping Firecrawl scrape",
      };
    }

    const client = new FirecrawlApp({ apiKey: config.firecrawlApiKey });

    try {
      const result = await client.scrapeUrl(url, {
        formats: ["extract"],
        extract: {
          schema: JobListSchema,
          prompt:
            "Extract all job listings from this page. For each job, get the title, the direct URL to the job posting (use absolute URLs), and the location.",
        },
      });

      if (!result.success || !result.extract) {
        return {
          company,
          jobs: [],
          scrapedAt: new Date().toISOString(),
          source: "firecrawl",
          error: `Firecrawl extraction failed for ${url}`,
        };
      }

      const extracted = result.extract as z.infer<typeof JobListSchema>;

      // Resolve relative URLs against the page base
      const baseUrl = new URL(url);
      const jobs: Job[] = (extracted.jobs ?? []).map((j) => {
        let jobUrl = j.url;
        try {
          jobUrl = new URL(j.url, baseUrl.origin).href;
        } catch {
          // keep as-is if URL parsing fails
        }
        return {
          company,
          title: j.title,
          url: jobUrl,
          location: j.location || "Not specified",
          externalId: jobUrl,
        };
      });

      return { company, jobs, scrapedAt: new Date().toISOString(), source: "firecrawl" };
    } catch (err) {
      return {
        company,
        jobs: [],
        scrapedAt: new Date().toISOString(),
        source: "firecrawl",
        error: `Firecrawl error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};
