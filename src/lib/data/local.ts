// Local JSON adapter: the dev/preview store, reading files under data/ at
// the project root. The Supabase adapter replaces it the moment its env vars
// exist (see index.ts).

import { promises as fs } from "fs";
import path from "path";
import { DEFAULT_SETTINGS, type LabEvent, type Settings } from "../types";

const DATA_DIR = path.join(process.cwd(), "data");

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, file), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// events

export async function getEvents(): Promise<LabEvent[]> {
  const events = await readJson<LabEvent[]>("events.json", []);
  return events.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

// settings

export async function getSettings(): Promise<Settings> {
  const stored = await readJson<Partial<Settings>>("settings.json", {});
  return { ...DEFAULT_SETTINGS, ...stored };
}
