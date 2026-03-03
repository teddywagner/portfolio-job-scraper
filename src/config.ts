export function getConfig() {
  return {
    firecrawlApiKey: process.env.FIRECRAWL_API_KEY ?? "",
    supabaseUrl: process.env.SUPABASE_URL ?? "",
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    snapshotDir: "data/snapshots",
    outputDir: "data/output",
  };
}
