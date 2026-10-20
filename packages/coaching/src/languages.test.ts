import { LANGUAGE_CODES } from "@cs2/contracts/languages";
import { describe, expect, it } from "vitest";
import {
  COACH_CAVEATS,
  languageInstruction,
  languageReminder,
  languageShare,
  offLanguage,
} from "./languages.js";

/** A short coaching paragraph per language, as a model should write it. */
const SAMPLES: Record<string, string> = {
  en: "You died first in the round and nobody could trade you. Next time wait for your teammate and play with the flash; you should always have a plan before you peek.",
  pt: "Você morreu primeiro na rodada e ninguém conseguiu fazer o trade. Na próxima, espere o seu companheiro e jogue com a flash; sempre tenha um plano antes de dar o peek, também com mais calma.",
  es: "Moriste primero en la ronda y nadie pudo hacer el trade. La próxima vez espera a tu compañero y juega con la flash; siempre ten un plan antes del peek, pero también con calma.",
  ru: "Ты умер первым в раунде, и никто не смог сделать трейд. В следующий раз жди тиммейта и играй через флешку; всегда имей план перед пиком.",
  zh: "你在这一回合第一个阵亡，队友没能补枪。下次等队友一起，配合闪光弹再出去；拉枪之前一定要有计划。",
  de: "Du bist in der Runde als Erster gestorben und niemand konnte den Trade holen. Warte das nächste Mal auf deinen Mitspieler und spiel mit der Flash; du brauchst immer einen Plan, bevor du peekst.",
  fr: "Tu es mort le premier dans la manche et personne n'a pu faire le trade. La prochaine fois, attends ton coéquipier et joue avec la flash ; aie toujours un plan avant de peek, pas après.",
  pl: "Zginąłeś pierwszy w rundzie i nikt nie zrobił trade'u. Następnym razem poczekaj na kolegę i graj z flashem; zawsze miej plan przed peekiem, nie po nim.",
  tr: "Rauntta ilk sen öldün ve kimse trade alamadı. Bir dahaki sefere takım arkadaşını bekle ve flash ile oyna; peek atmadan önce her zaman bir plan yap, sonra değil.",
};

describe("output languages", () => {
  it("has an instruction, a reminder and every caveat for all 9 languages", () => {
    for (const lang of LANGUAGE_CODES) {
      expect(languageInstruction(lang)).toMatch(/LANGUAGE \(mandatory\)/);
      expect(languageReminder(lang)).toMatch(/Answer in/);
      for (const table of Object.values(COACH_CAVEATS)) {
        const v = table[lang];
        const text = typeof v === "function" ? v(2) : v;
        expect(text.length, `${lang}`).toBeGreaterThan(10);
        expect(text).not.toMatch(/[—]/);
      }
    }
    expect(languageInstruction("de")).toMatch(/German only.*für/);
    expect(languageInstruction("zh")).toMatch(
      /Simplified Chinese.*never Traditional/,
    );
    expect(languageReminder("pt")).toMatch(/^Responda em português do Brasil/);
  });
  it("judges whether an answer is in the requested language", () => {
    for (const [lang, text] of Object.entries(SAMPLES)) {
      const l = lang as keyof typeof SAMPLES & (typeof LANGUAGE_CODES)[number];
      expect(offLanguage(text, l), `${lang} in ${lang}`).toBe(false);
      expect(languageShare(text, l)!, lang).toBeGreaterThan(0.6);
      if (lang !== "en")
        expect(offLanguage(SAMPLES.en!, l), `English asked as ${lang}`).toBe(
          true,
        );
    }
    expect(offLanguage(SAMPLES.pt!, "en")).toBe(true);
    expect(offLanguage(SAMPLES.es!, "pt")).toBe(true);
    expect(languageShare("ok", "pt")).toBeNull();
  });
});
