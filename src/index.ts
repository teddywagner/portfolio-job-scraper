import { readInputExcel } from "./excel";
import { getConfig } from "./config";
import { getScraperForUrl } from "./scrapers";
import { saveSnapshot } from "./snapshot";
import { getPortfolioMap, upsertJobs, markRemovedJobs } from "./db";
import type { ScrapeResult } from "./scrapers/types";

async function main() {
  const config = getConfig();
  const startTime = Date.now();
  const runTimestamp = new Date().toISOString();

  console.log("=== Portfolio Job Scraper ===\n");

  // 1. Read input
  console.log(`Reading ${config.inputFile}...`);
  const companies = readInputExcel(config.inputFile);
  const withLink = companies.filter((c) => c.jobsLink);
  const withoutLink = companies.filter((c) => !c.jobsLink);
  console.log(`  ${withLink.length} companies with job links`);
  console.log(`  ${withoutLink.length} companies without job links\n`);

  // 2. Load portfolio map from Supabase
  console.log("Loading portfolio map from Supabase...");
  const portfolioMap = await getPortfolioMap();
  console.log(`  ${portfolioMap.size} portfolio companies loaded\n`);

  // 3. Scrape
  const results: ScrapeResult[] = [];

  for (const entry of withLink) {
    const scraper = getScraperForUrl(entry.jobsLink!);
    process.stdout.write(`  ${entry.company} (${scraper.name})...`);

    try {
      const result = await scraper.scrape(entry.company, entry.jobsLink!);
      results.push(result);

      if (result.error) {
        console.log(` WARN: ${result.error}`);
      } else {
        console.log(` ${result.jobs.length} jobs`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(` ERROR: ${msg}`);
      results.push({
        company: entry.company,
        jobs: [],
        scrapedAt: new Date().toISOString(),
        source: "error",
        error: msg,
      });
    }
  }

  console.log();

  // 4. Save snapshot (local backup)
  saveSnapshot(config.snapshotDir, results);

  // 5. Upsert to DB, grouped by company
  console.log("\n  Syncing to database...");
  const resultsByCompany = new Map<string, ScrapeResult[]>();
  for (const result of results) {
    if (result.error || result.jobs.length === 0) continue;
    const existing = resultsByCompany.get(result.company) ?? [];
    existing.push(result);
    resultsByCompany.set(result.company, existing);
  }

  let totalUpserted = 0;
  let totalRemoved = 0;

  for (const [company, companyResults] of resultsByCompany) {
    const portfolioId = portfolioMap.get(company.toLowerCase());
    if (!portfolioId) {
      console.log(`    WARN: "${company}" not found in portfolio table — skipping`);
      continue;
    }

    for (const result of companyResults) {
      const externalIds = result.jobs.map((j) => j.externalId);

      await upsertJobs(portfolioId, result.jobs, result.source, runTimestamp);
      totalUpserted += result.jobs.length;

      const removed = await markRemovedJobs(portfolioId, result.source, externalIds);
      totalRemoved += removed;
    }
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
