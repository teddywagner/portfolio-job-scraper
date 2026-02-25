/** A single scraped job posting */
export interface Job {
  company: string;
  title: string;
  url: string;
  location: string;
  publishedAt?: string;
  compensation?: {
    min: number;
    max: number;
    currency: string;
    interval: string;
  };
  externalId: string;
}

/** Result from scraping one company */
export interface ScrapeResult {
  company: string;
  jobs: Job[];
  scrapedAt: string;
  source: string;
  error?: string;
}

/** Scraper interface — each platform adapter implements this */
export interface Scraper {
  name: string;
  canHandle(url: string): boolean;
  scrape(company: string, url: string): Promise<ScrapeResult>;
}
