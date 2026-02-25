import * as fs from "fs";
import * as XLSX from "xlsx";
import type { CompanyEntry } from "./config";

XLSX.set_fs(fs);

export function readInputExcel(filePath: string): CompanyEntry[] {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<{ company: string; jobs_link?: string }>(sheet);

  return rows.map((row) => ({
    company: row.company,
    jobsLink: row.jobs_link?.trim() || null,
  }));
}
