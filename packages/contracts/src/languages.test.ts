import { describe, expect, it } from "vitest";
import {
  acceptLanguageTags,
  detectLanguage,
  matchLanguage,
  parseLanguage,
} from "./languages.js";

describe("languages", () => {
  it("maps browser tags to the 9 supported languages", () => {
    expect(matchLanguage("pt-PT")).toBe("pt");
    expect(matchLanguage("zh-Hant-TW")).toBe("zh");
    expect(matchLanguage("de-AT")).toBe("de");
    expect(matchLanguage("ja")).toBeNull();
    expect(detectLanguage(["ja-JP", "ru-RU", "en"])).toBe("ru");
    expect(detectLanguage(["ja"])).toBe("en");
    expect(parseLanguage("xx")).toBe("en");
  });
  it("orders Accept-Language by q-value", () => {
    expect(acceptLanguageTags("en;q=0.5, pl-PL, tr;q=0.8, *")).toEqual([
      "pl-PL",
      "tr",
      "en",
    ]);
    expect(acceptLanguageTags(null)).toEqual([]);
  });
});
