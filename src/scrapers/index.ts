import type { Scraper } from "./types";
import { ashbyScraper } from "./ashby";
import { greenhouseScraper } from "./greenhouse";
import { leverScraper } from "./lever";
import { firecrawlScraper } from "./firecrawl";

// Ordered by specificity — platform-specific first, generic catch-all last
const scrapers: Scraper[] = [
  ashbyScraper,
  greenhouseScraper,
  leverScraper,
  firecrawlScraper,
];

export function getScraperForUrl(url: string): Scraper {
  return scrapers.find((s) => s.canHandle(url))!;
}
