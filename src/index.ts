import { getConfig } from "./config";
import { getScraperForUrl } from "./scrapers";
import { saveSnapshot } from "./snapshot";
import { getJobSources, upsertJobs, markRemovedJobs } from "./db";
import type { ScrapeResult } from "./scrapers/types";

async function main() {
  const config = getConfig();
  const startTime = Date.now();
  const runTimestamp = new Date().toISOString();

  console.log("=== Portfolio Job Scraper ===\n");

  // 1. Load job sources from Supabase
  const scraperMode = process.env.SCRAPER_MODE as
    | "free"
    | "firecrawl"
    | undefined;
  if (scraperMode) console.log(`  Mode: ${scraperMode}`);

  console.log("Loading job sources from Supabase...");
  const sources = await getJobSources(scraperMode);
  console.log(`  ${sources.length} sources to scrape\n`);

  // 2. Scrape
  const results: (ScrapeResult & { portfolioId: number })[] = [];

  for (const source of sources) {
    const scraper = getScraperForUrl(source.jobsLink);
    process.stdout.write(`  ${source.company} (${scraper.name})...`);

    try {
      const result = await scraper.scrape(source.company, source.jobsLink);
      results.push({ ...result, portfolioId: source.portfolioId });

      if (result.error) {
        console.log(` WARN: ${result.error}`);
      } else {
        console.log(` ${result.jobs.length} jobs`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(` ERROR: ${msg}`);
      results.push({
        company: source.company,
        jobs: [],
        scrapedAt: new Date().toISOString(),
        source: "error",
        error: msg,
        portfolioId: source.portfolioId,
      });
    }
  }

  console.log();

  // 3. Save snapshot (local backup)
  saveSnapshot(config.snapshotDir, results);

  // 4. Upsert to DB
  console.log("\n  Syncing to database...");
  let totalUpserted = 0;
  let totalRemoved = 0;

  for (const result of results) {
    if (result.error || result.jobs.length === 0) continue;

    const externalIds = result.jobs.map((j) => j.externalId);
    await upsertJobs(result.portfolioId, result.jobs, result.source, runTimestamp);
    totalUpserted += result.jobs.length;

    const removed = await markRemovedJobs(result.portfolioId, result.source, externalIds);
    totalRemoved += removed;
  }

  console.log(`    Upserted: ${totalUpserted} jobs`);
  console.log(`    Marked removed: ${totalRemoved} jobs`);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nDone in ${elapsed}s`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
