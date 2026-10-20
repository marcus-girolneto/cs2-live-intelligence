// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { isRawCallout } from "@cs2/contracts/callouts";
import { DeepSections, normalizeDeep } from "@/features/coach";
import { LanguageProvider } from "@/shared/i18n";
import { loadDictionary } from "./locales";

/** A real deep review (deterministic modules, raw demo callouts, machine tags). */
const deep = normalizeDeep(
  JSON.parse(
    readFileSync(
      join(__dirname, "../features/coach/model/fixtures/deep-review.json"),
      "utf8",
    ),
  ),
)!;
// Words that only appear when an English sentence leaks into a translated page.
const ENGLISH =
  /(?<![\p{L}])(?:the|you|your|and|with|of|away|units|average|traded|deaths|enemies|blinded|damage|thrown|from|into|times|won|lost)(?![\p{L}])/giu;

afterEach(cleanup);
let pt: Record<string, string> = {};
beforeAll(async () => {
  pt = await loadDictionary("pt");
});

describe("deep report in Portuguese", () => {
  it("has no English sentence, snake_case tag or raw callout", () => {
    const { container } = render(
      <LanguageProvider initial="pt" initialDictionary={pt}>
        <DeepSections deep={deep} onPlay={() => {}} />
      </LanguageProvider>,
    );
    // Text node by text node, so adjacent elements do not glue words together.
    const textOf = (el: Element) => {
      const parts: string[] = [];
      const walker = document.createTreeWalker(el, 4);
      for (let n = walker.nextNode(); n; n = walker.nextNode())
        parts.push(n.textContent ?? "");
      for (const x of el.querySelectorAll("[title]"))
        parts.push(x.getAttribute("title") ?? "");
      return parts.join(" ");
    };
    const text = textOf(container);
    expect(text.length).toBeGreaterThan(200);
    expect(text.match(ENGLISH) ?? []).toEqual([]);
    expect(text.match(/\b[a-z]+_[a-z_]+\b/g) ?? []).toEqual([]);
    const raw = (text.match(/[A-Za-z][A-Za-z0-9]*/g) ?? []).filter(
      isRawCallout,
    );
    expect(raw).toEqual([]);
    expect(text).not.toMatch(/\bunits?\b/);
    expect(text).toMatch(/\d+ m\b/);
  });
});
