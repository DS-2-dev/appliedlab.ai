#!/usr/bin/env node
// The mechanical arm of the Lab voice. The canonical spec (16 rules, genre
// boundary, worked examples) lives in .claude/skills/lab-voice/SKILL.md at
// the repo root; rules are cited here by number. Scans every public copy
// source for em dashes (§3.3), the banned lexicon (§3.2 + §3.6), splice
// punctuation, and stale schedule words.
// Run: node scripts/copy-lint.mjs

import { readFileSync } from "fs";
import path from "path";

const FILES = [
  "src/content/copy.ts",
  // Added 2026-08-16 with the IA restructure: these are public copy too, and
  // the handbook is the largest single body of prose on the site.
  "src/content/handbook.ts",
  "src/content/cases.ts",
  "src/content/showcase.ts",
  "data/settings.json",
  "data/events.json",
  "data/showcase.json",
];

// §3.2 + §3.6 banned vocabulary (single words / short phrases, case-insensitive)
const BANNED = [
  "revolutionary", "game-changing", "cutting-edge", "unleash", "supercharge",
  "seamless", "the future of",
  "delve", "tapestry", "testament", "vibrant", "crucial", "pivotal", "robust",
  "transformative", "profound", "comprehensive", "multifaceted", "realm",
  "harness", "foster", "empower", "elevate", "embrace", "resonate",
  "underscore", "boast", "in conclusion", "in summary",
  "it's important to note", "not only", "when it comes to", "paving the way",
  "in a world where", "at the end of the day",
  "furthermore", "moreover", "additionally", "with that in mind",
  "building on this", "this brings us to", "it is worth noting",
];

// words that contain banned substrings but are fine ("navigate" nav, etc.)
const ALLOW_PATTERNS = [/\bnav\b/i, /journeyman/i];

// Narrow, documented exceptions: exact strings quoted verbatim from a source
// document, where rewriting would misquote it. Each needs a reason. Keep this
// list short; a growing list means the lexicon rule is being routed around.
//
// OPEN FOR KYLAR: "elevate" is on the §3.2 banned list, and it is also the verb
// in the master plan's purpose statement. The ban targets AI-tell vocabulary,
// and this is a human-authored mission line, so it is quoted as written. If you
// would rather change the line, change it in master-plan.md first and this
// exception goes away.
const VERBATIM_EXCEPTIONS = [
  "To bring people together, ask hard questions, and elevate everyone involved.",
];

// Voice rules (Kylar, 2026-08-19): no semicolons in prose, and no appositive
// colons (a colon welding a claim to its elaboration). Colons survive before
// times ("1:30"), in labels ending with a quoted list item, and in emails/URLs,
// which the checks below exempt.
const COLON_EXCEPTIONS = [/\d:\d/, /https?:/, /mailto:/, /: ailab@/];

// Voice rule 13 (v5, 2026-08-19): prose never names a weekday, a clock time,
// or a bare month. Schedule facts live in data (events.json, settings.json)
// and render from it, so copy cannot go stale when the calendar moves. Checked
// in src/content only; the data files hold the real dates, and short chips
// ("Thu Sep 3") pass.
const STALE_PATTERNS = [
  { re: /\b(Mondays?|Tuesdays?|Wednesdays?|Thursdays?|Fridays?|Saturdays?|Sundays?)\b/, label: "WEEKDAY" },
  { re: /\b\d{1,2}:\d{2}\s?[ap]m\b/i, label: "CLOCK TIME" },
];
// The month check skips cases.ts and showcase.ts (months there are case
// narrative, "The August inbox") and skips strings carrying a year
// ("December 2026" is a dated roadmap entry, not a schedule fact).
const MONTH_FILES = new Set(["src/content/copy.ts", "src/content/handbook.ts"]);
const MONTHS = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/;

let failures = 0;

for (const file of FILES) {
  const full = path.resolve(process.cwd(), file);
  let text;
  try {
    text = readFileSync(full, "utf8");
  } catch {
    continue;
  }

  const lines = text.split("\n");
  // comments are internal, not rendered, and the spec header quotes dead
  // lines as counter-examples, so block-comment interiors must be skipped too
  let inBlockComment = false;
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (inBlockComment) {
      if (trimmed.includes("*/")) inBlockComment = false;
      return;
    }
    if (trimmed.startsWith("/*")) {
      if (!trimmed.includes("*/")) inBlockComment = true;
      return;
    }
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;
    if (VERBATIM_EXCEPTIONS.some((q) => line.includes(q))) return;

    if (line.includes("—")) {
      console.log(`${file}:${i + 1}  EM DASH: ${trimmed.slice(0, 90)}`);
      failures++;
    }
    // splice checks run on quoted copy strings only, not code
    const strings = [...line.matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"/g)].map((m) => m[1]);
    for (const str of strings) {
      if (str.length < 15) continue; // labels, hrefs, keys
      if (str.includes(";")) {
        console.log(`${file}:${i + 1}  SEMICOLON: ${str.slice(0, 90)}`);
        failures++;
      }
      if (/: [a-z]/.test(str) && !COLON_EXCEPTIONS.some((p) => p.test(str))) {
        console.log(`${file}:${i + 1}  PROSE COLON: ${str.slice(0, 90)}`);
        failures++;
      }
    }
    if (file.startsWith("src/content")) {
      for (const str of strings) {
        for (const { re, label } of STALE_PATTERNS) {
          if (re.test(str)) {
            console.log(`${file}:${i + 1}  ${label}: ${str.slice(0, 90)}`);
            failures++;
          }
        }
        if (MONTH_FILES.has(file) && MONTHS.test(str) && !/\b20\d{2}\b/.test(str)) {
          console.log(`${file}:${i + 1}  BARE MONTH: ${str.slice(0, 90)}`);
          failures++;
        }
      }
    }
    for (const term of BANNED) {
      const re = new RegExp(`\\b${term.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "i");
      if (re.test(line) && !ALLOW_PATTERNS.some((p) => p.test(line))) {
        console.log(`${file}:${i + 1}  BANNED "${term}": ${trimmed.slice(0, 90)}`);
        failures++;
      }
    }
  });
}

if (failures) {
  console.error(`\n${failures} copy violation(s).`);
  process.exit(1);
} else {
  console.log("Copy clean: no em dashes, no banned vocabulary.");
}
