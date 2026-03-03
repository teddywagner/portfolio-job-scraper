import { firecrawlScraper } from "./src/scrapers/firecrawl";

const targets = [
  { company: "Profitmind", url: "https://careers.aifund.ai/jobs/profitmind" },
  { company: "Synthefy", url: "https://www.synthefy.com/careers" },
];

for (const t of targets) {
  console.log(`\n=== ${t.company} ===`);
  const result = await firecrawlScraper.scrape(t.company, t.url);
  if (result.error) {
    console.log(`ERROR: ${result.error}`);
  } else {
    console.log(`${result.jobs.length} jobs found:`);
    for (const j of result.jobs) {
      console.log(`  Title: ${j.title}`);
      console.log(`  URL:   ${j.url}`);
      console.log(`  Loc:   ${j.location}`);
      console.log("");
    }
  }
}
