import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getConfig } from "./config";
import type { Job } from "./scrapers/types";

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (client) return client;
  const config = getConfig();
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  client = createClient(config.supabaseUrl, config.supabaseServiceRoleKey);
  return client;
}

/** Fetch portfolio table and return Map<lowercase company name, id> */
export async function getPortfolioMap(): Promise<Map<string, number>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("portfolio")
    .select("id, name");

  if (error) throw new Error(`Failed to fetch portfolio: ${error.message}`);

  const map = new Map<string, number>();
  for (const row of data ?? []) {
    map.set(String(row.name).toLowerCase(), row.id);
  }
  return map;
}

/** Upsert scraped jobs for a given portfolio company */
export async function upsertJobs(
  portfolioId: number,
  jobs: Job[],
  source: string,
  runTimestamp: string
): Promise<void> {
  if (jobs.length === 0) return;

  const supabase = getSupabaseClient();

  // Deduplicate by externalId — Postgres can't upsert the same row twice in one statement
  const seen = new Set<string>();
  const deduped = jobs.filter((j) => {
    if (seen.has(j.externalId)) return false;
    seen.add(j.externalId);
    return true;
  });

  const rows = deduped.map((j) => ({
    portfolio_id: portfolioId,
    source,
    external_id: j.externalId,
    job_title: j.title,
    location: j.location,
    url: j.url,
    status: "Active",
    first_seen: runTimestamp,
    last_seen: runTimestamp,
    published_at: j.publishedAt ?? null,
    compensation_min: j.compensation?.min ?? null,
    compensation_max: j.compensation?.max ?? null,
    compensation_currency: j.compensation?.currency ?? null,
    compensation_interval: j.compensation?.interval ?? null,
  }));

  // Upsert in batches of 500 to stay within limits
  const BATCH_SIZE = 500;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("jobs")
      .upsert(batch, {
        onConflict: "source,external_id",
        ignoreDuplicates: false,
      });

    if (error) {
      throw new Error(`Failed to upsert jobs batch: ${error.message}`);
    }
  }
}

/** Mark jobs as Removed if they weren't in the current scrape */
export async function markRemovedJobs(
  portfolioId: number,
  source: string,
  currentExternalIds: string[]
): Promise<number> {
  const supabase = getSupabaseClient();

  // Fetch all active/non-removed jobs for this portfolio+source
  const { data: existing, error: fetchError } = await supabase
    .from("jobs")
    .select("id, external_id")
    .eq("portfolio_id", portfolioId)
    .eq("source", source)
    .neq("status", "Removed");

  if (fetchError) {
    throw new Error(`Failed to fetch existing jobs: ${fetchError.message}`);
  }

  const currentSet = new Set(currentExternalIds);
  const toRemove = (existing ?? [])
    .filter((row) => !currentSet.has(row.external_id))
    .map((row) => row.id);

  if (toRemove.length === 0) return 0;

  // Update in batches
  const BATCH_SIZE = 500;
  for (let i = 0; i < toRemove.length; i += BATCH_SIZE) {
    const batch = toRemove.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("jobs")
      .update({ status: "Removed" })
      .in("id", batch);

    if (error) {
      throw new Error(`Failed to mark removed jobs: ${error.message}`);
    }
  }

  return toRemove.length;
}
