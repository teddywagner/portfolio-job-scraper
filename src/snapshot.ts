import * as fs from "fs";
import * as path from "path";
import type { Job, ScrapeResult } from "./scrapers/types";

export interface Snapshot {
  timestamp: string;
  results: ScrapeResult[];
  allJobs: Job[];
}

export interface DiffResult {
  newJobs: Job[];
  removedJobs: Job[];
  unchangedJobs: Job[];
}

function jobKey(job: Job): string {
  return `${job.company}|||${job.title}|||${job.url}`;
}

export function saveSnapshot(snapshotDir: string, results: ScrapeResult[]): Snapshot {
  fs.mkdirSync(snapshotDir, { recursive: true });

  const allJobs = results.flatMap((r) => r.jobs);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const snapshot: Snapshot = { timestamp, results, allJobs };

  const filePath = path.join(snapshotDir, `snapshot-${timestamp}.json`);
  fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2));
  console.log(`  Snapshot saved: ${filePath}`);
  return snapshot;
}

export function loadLatestSnapshot(snapshotDir: string): Snapshot | null {
  if (!fs.existsSync(snapshotDir)) return null;

  const files = fs
    .readdirSync(snapshotDir)
    .filter((f) => f.startsWith("snapshot-") && f.endsWith(".json"))
    .sort()
    .reverse();

  if (files.length === 0) return null;

  const content = fs.readFileSync(path.join(snapshotDir, files[0]), "utf-8");
  return JSON.parse(content) as Snapshot;
}

export function diffSnapshots(current: Job[], previous: Job[] | null): DiffResult {
  if (!previous) {
    return { newJobs: current, removedJobs: [], unchangedJobs: [] };
  }

  const prevKeys = new Set(previous.map(jobKey));
  const currKeys = new Set(current.map(jobKey));

  return {
    newJobs: current.filter((j) => !prevKeys.has(jobKey(j))),
    removedJobs: previous.filter((j) => !currKeys.has(jobKey(j))),
    unchangedJobs: current.filter((j) => prevKeys.has(jobKey(j))),
  };
}
