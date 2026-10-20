import { describe, expect, it } from "vitest";
import { createFormatters } from "@/shared/i18n";
import { scoreBasisText } from "./scoreBasis";

const de: Record<string, string> = {
  accuracy: "Treffsicherheit",
  "average death time": "durchschnittlicher Todeszeitpunkt",
  "{metric} {value} (lobby {lobby})": "{metric} {value} (Lobby {lobby})",
  "opening duels won {w} of {n}": "gewonnene Opening-Duelle: {w} von {n}",
};
const t = (text: string, vars?: Record<string, string | number>) =>
  (de[text] ?? text).replace(/\{(\w+)\}/g, (_, k) => String(vars?.[k] ?? ""));

describe("scoreBasisText", () => {
  it("rewrites the deterministic basis in the reader's language and number style", () => {
    const fmt = createFormatters("de-DE");
    expect(
      scoreBasisText(
        "accuracy 39.2% (lobby 18.8%); average death time 43.8 s (lobby 40.7 s)",
        t,
        fmt,
      ),
    ).toBe(
      "Treffsicherheit 39,2% (Lobby 18,8%); durchschnittlicher Todeszeitpunkt 43,8 s (Lobby 40,7 s)",
    );
    expect(scoreBasisText("opening duels won 7 of 12", t, fmt)).toBe(
      "gewonnene Opening-Duelle: 7 von 12",
    );
    expect(scoreBasisText("something new", t, fmt)).toBe("something new");
  });
});
