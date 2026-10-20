// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReplayApiProvider, type ReplayApi } from "@/features/replay";
import { LanguageProvider } from "@/shared/i18n";
import { TrainingApiProvider } from "../api/context";
import { pt } from "../i18n/pt";
import type { TrainingApi } from "../api/training.api";
import catalogJson from "../model/fixtures/catalog.json";
import planJson from "../model/fixtures/training-plan.json";
import { normalizeCatalog, normalizePlan } from "../model/normalize";
import { TrainThis } from "./TrainThis";

afterEach(cleanup);
const dictionaries = { en: {}, pt };

const api: TrainingApi = {
  catalog: async () => normalizeCatalog(catalogJson),
  forAnalysis: async () => normalizePlan(planJson),
  recommended: async () => ({
    steamId: null,
    latest: null,
    focus: [],
    week: [],
  }),
};
const replay = {
  getMeta: async () => ({
    map: "de_mirage",
    cell: 64,
    tickRate: 64,
    sampleHz: 8,
    rounds: [],
    players: [],
    bounds: { minX: -2600, maxX: 1400, minY: -2600, maxY: 900 },
    outline: [
      [0, 0],
      [64, 0],
    ],
  }),
  getWindow: async () => {
    throw new Error("unused");
  },
} as unknown as ReplayApi;

function show(lang: "en" | "pt", onPlay = vi.fn()) {
  render(
    <LanguageProvider initial={lang} dictionaries={dictionaries}>
      <TrainingApiProvider value={api}>
        <ReplayApiProvider value={replay}>
          <TrainThis analysisId="a1" steamId="7" onPlay={onPlay} />
        </ReplayApiProvider>
      </TrainingApiProvider>
    </LanguageProvider>,
  );
  return onPlay;
}

describe("TrainThis", () => {
  it("renders the pro-team session, Steam buttons and the practice server", async () => {
    const onPlay = show("en");
    expect(await screen.findByText("Train this")).toBeTruthy();
    const sessions = await screen.findAllByTestId("training-session");
    expect(sessions.length).toBeGreaterThanOrEqual(5);
    expect(screen.getByText("Pro-team session")).toBeTruthy();
    expect(screen.getByTestId("practice-server").textContent).toMatch(
      /sv_cheats 1/,
    );
    expect(screen.getByText("Where you died")).toBeTruthy();
    expect(screen.getByText("Your best lineups")).toBeTruthy();
    expect(screen.getByText("Crosshair spots")).toBeTruthy();
    for (const a of document.querySelectorAll("a[href]")) {
      const href = a.getAttribute("href")!;
      expect(href, href).toMatch(
        /^(steam:\/\/(rungameid\/730|url\/CommunityFilePage\/\d+)|https:\/\/steamcommunity\.com\/)/,
      );
    }
    const external = [...document.querySelectorAll("a[target=_blank]")];
    expect(external.length).toBeGreaterThan(0);
    for (const a of external) expect(a.getAttribute("rel")).toMatch(/noopener/);
    expect(document.body.textContent).not.toMatch(/degree|°|\{\w+\}/);
    fireEvent.click(screen.getAllByRole("button", { name: /Round \d+/ })[0]!);
    expect(onPlay).toHaveBeenCalledWith(
      expect.objectContaining({ steamId: expect.any(String) }),
      expect.any(String),
    );
  });

  it("is translated to Portuguese", async () => {
    show("pt");
    expect(await screen.findByText("Treine isso")).toBeTruthy();
    expect(screen.getByText("Sessão de time pro")).toBeTruthy();
    expect(screen.getByText("Onde você morreu")).toBeTruthy();
    expect(screen.getAllByText(/Pronto quando:/).length).toBeGreaterThan(3);
  });
});
