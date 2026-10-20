#!/usr/bin/env node
// Fails when a tracked text file uses an em dash, or a spaced en dash as punctuation.
// Copy, docs and comments use commas, periods, colons or parentheses instead.
// En dashes stay allowed in ranges and scores ("11–5", "60–90 min").
// Tests are skipped: some assert that the AI output guard removes dashes.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const SKIP = [
  /(^|\/)pnpm-lock\.yaml$/,
  /(^|\/)testdata\//,
  /\.(test|spec)\.[cm]?[jt]sx?$/,
  /_test\.go$/,
  /\.(png|jpe?g|gif|webp|ico|dem|gz|zip|woff2?|ttf|otf|mp4|webm|pdf)$/i,
];
const EM = "\u2014";
const SPACED_EN = / \u2013 /;

const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter((f) => f && !SKIP.some((re) => re.test(f)));

const hits = [];
for (const file of files) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue; // deleted in the working tree
  }
  if (text.includes("\0")) continue;
  text.split("\n").forEach((line, i) => {
    if (line.includes(EM) || SPACED_EN.test(line))
      hits.push(`${file}:${i + 1}: ${line.trim().slice(0, 120)}`);
  });
}

if (hits.length) {
  console.error(
    `Found ${hits.length} dash(es) used as punctuation. Rewrite with a comma, period, colon or parentheses:\n`,
  );
  console.error(hits.join("\n"));
  process.exit(1);
}
console.log(`check:copy ok (${files.length} files)`);
