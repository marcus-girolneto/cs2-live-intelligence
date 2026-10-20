/**
 * Output language of every AI purpose: the mandatory instruction appended to the system
 * prompt, the short reminder placed before and after the data, the language-purity check
 * applied to the model's answer and the fixed caveats the coach adds itself.
 */
import {
  LANGUAGE_CODES,
  LANGUAGES,
  parseLanguage,
  type LanguageCode,
} from "@cs2/contracts/languages";

export type CoachLang = LanguageCode;
export const COACH_LANGS: readonly CoachLang[] = LANGUAGE_CODES;
/** Unknown values fall back to English (request bodies, stored settings). */
export const parseCoachLang = (value: unknown): CoachLang =>
  parseLanguage(value);

type Rule = {
  /** How the instruction names the language. */
  name: string;
  /** CS2 terms this community keeps as they are (or in its usual slang form). */
  terms: string;
  /** Reminder in the target language, followed by the English one. */
  native: string;
  /** Spelling rule: models sometimes drop diacritics or switch script. */
  spelling: string;
  /** A correct sentence the model can imitate. */
  example: string;
};
const RULES: Record<CoachLang, Rule> = {
  en: { name: "English", terms: "", native: "", spelling: "", example: "" },
  pt: {
    name: "Brazilian Portuguese",
    terms:
      "ADR, KAST, HS, AWP, clutch, trade, entry, eco, force buy, IGL, lurk, retake",
    native: "Responda em português do Brasil, com todos os acentos.",
    spelling:
      'Use correct Brazilian Portuguese spelling with every accent and cedilla (á â ã à ç é ê í ó ô õ ú): write "não", "você", "posição", "também", never "nao", "voce", "posicao", "tambem".',
    example:
      "Você morreu sem troca na posição do bomb A; também faltou informação antes do pós-plant.",
  },
  es: {
    name: "Spanish (neutral, understood in Spain and Latin America)",
    terms:
      "ADR, KAST, HS, AWP, clutch, trade, entry, eco, force buy, IGL, lurk, retake",
    native: "Responde en español, con todas las tildes.",
    spelling:
      'Use correct Spanish spelling with every accent and ñ (á é í ó ú ñ ü ¿ ¡): write "también", "después", "posición", "daño", never "tambien", "despues", "posicion", "dano".',
    example:
      "Moriste sin trade en la posición de A; después del plant también faltó información.",
  },
  ru: {
    name: "Russian",
    terms:
      "ADR, KAST, HS, AWP, IGL in Latin letters; the usual Russian CS slang is fine (клатч, трейд, энтри, эко, форс, раскидка, ретейк)",
    native: "Отвечай на русском языке.",
    spelling:
      "Write in Cyrillic with correct Russian spelling and grammar; never transliterate Russian into Latin letters.",
    example:
      "Ты умер без трейда на позиции A; после планта команде тоже не хватило информации.",
  },
  zh: {
    name: "Simplified Chinese",
    terms:
      "ADR, KAST, HS, AWP in Latin letters; use the usual Chinese CS terms (残局, 补枪, 首杀, 经济局, 强起, 道具, 指挥, 自由人, 回防)",
    native: "请用简体中文回答。",
    spelling:
      "Use Simplified Chinese characters (never Traditional) and Chinese punctuation (，。：；).",
    example: "你在A点阵亡时没有队友补枪；下包后团队也缺少信息。",
  },
  de: {
    name: "German",
    terms:
      "ADR, KAST, HS, AWP, Clutch, Trade, Entry, Eco, Force Buy, IGL, Lurk, Retake, Utility",
    native: "Antworte auf Deutsch, mit Umlauten.",
    spelling:
      'Use correct German spelling with umlauts and ß (ä ö ü ß): write "für", "über", "nächste", never "fur", "uber", "naechste".',
    example:
      "Du bist ohne Trade auf der A-Position gestorben; nach dem Plant fehlten auch Infos für dein Team.",
  },
  fr: {
    name: "French",
    terms:
      "ADR, KAST, HS, AWP, clutch, trade, entry, eco, force buy, IGL, lurk, retake",
    native: "Réponds en français, avec tous les accents.",
    spelling:
      'Use correct French spelling with every accent (é è ê à â ç î ô ù û ë ï): write "très", "déjà", "équipe", "après", never "tres", "deja", "equipe", "apres".',
    example:
      "Tu es mort sans trade sur la position A ; après le plant, l'équipe a aussi manqué d'infos.",
  },
  pl: {
    name: "Polish",
    terms:
      "ADR, KAST, HS, AWP, clutch, trade, entry, eco, force buy, IGL, lurk, retake",
    native: "Odpowiadaj po polsku, z polskimi znakami.",
    spelling:
      'Use correct Polish spelling with every diacritic (ą ć ę ł ń ó ś ź ż): write "się", "więcej", "będzie", "również", never "sie", "wiecej", "bedzie", "rowniez".',
    example:
      "Zginąłeś bez trade'u na pozycji A; po plancie drużynie zabrakło też informacji.",
  },
  tr: {
    name: "Turkish",
    terms:
      "ADR, KAST, HS, AWP, clutch, trade, entry, eco, force buy, IGL, lurk, retake",
    native: "Türkçe cevap ver, Türkçe karakterlerle.",
    spelling:
      'Use correct Turkish spelling with every special letter (ç ğ ı İ ö ş ü): write "için", "değil", "çok", "düşman", never "icin", "degil", "cok", "dusman".',
    example:
      "A pozisyonunda trade alamadan öldün; plant sonrası takıma bilgi de gelmedi.",
  },
};

/** The mandatory LANGUAGE rule appended at the end of every system prompt. */
export function languageInstruction(lang: CoachLang): string {
  const r = RULES[lang] ?? RULES.en;
  if (lang === "en")
    return "\n\nLANGUAGE (mandatory): write every human-readable field in English only. Do not mix languages. Keep ids, enum values, callout names and weapon names as they are.";
  return `\n\nLANGUAGE (mandatory): write every human-readable field (headlines, verdicts, summaries, observations, calls, reasons, caveats, plans, goals, notes, titles, drill names, how-to and metric texts) in ${r.name} only. Do not mix languages: no English sentences. Keep ids, enum values, callout names, weapon names and these CS2 terms as players of this language write them: ${r.terms}. ${r.spelling} Example: "${r.example}"`;
}
/** Short reminder placed before the data; small models follow the first and last lines best. */
export function languageReminder(lang: CoachLang): string {
  const r = RULES[lang] ?? RULES.en;
  return lang === "en"
    ? "Answer in English."
    : `${r.native} Answer in ${r.name.replace(/ \(.*\)$/, "")}${lang === "ru" || lang === "zh" ? "" : " with correct accents"}.`;
}
export const languageName = (lang: CoachLang): string =>
  LANGUAGES.find((l) => l.code === lang)?.english ?? "English";

// Function words per Latin-script language. A word that is also a function word of the
// requested language never counts as foreign ("que", "para", "na" are shared by several).
const STOPWORDS: Partial<Record<CoachLang, Set<string>>> = Object.fromEntries(
  Object.entries({
    en: "the you your and with when this that from have were was died should before after instead don't always never next which their there what into",
    pt: "você vocês seu sua seus suas com quando isso isto para não morreu abate abates rodada depois jogue sempre nunca próximo próxima uma um dos das no na que mais também então",
    es: "tú tu tus con cuando esto para moriste después juega siempre nunca próximo próxima una un los las el del que pero porque muy también entonces",
    de: "du dein deine deinen und mit wenn nicht ist sind der das dem den ein eine einen auf für statt immer nie nächste nächsten bevor nach auch",
    fr: "tu tes ton ta vous avec quand pour pas est sont le les une un des du au après avant toujours jamais prochaine prochain plutôt qui aussi",
    pl: "ty twój twoje twoich i z ze kiedy gdy nie jest są na do się zamiast zawsze nigdy następny następnej przed po która które też",
    tr: "sen senin ve ile zaman için değil bir bu şu daha her hiç sonra önce yerine sonraki olarak gibi çok",
  }).map(([l, words]) => [l, new Set(words.split(" "))]),
);
const WORD = /\p{L}+(?:['’]\p{L}+)?/gu;
const CYRILLIC_WORD = /^\p{Script=Cyrillic}{2,}$/u;
const HAN = /\p{Script=Han}/gu;

/**
 * Share (0 to 1) of the text written in `lang`, or null when there is too little text to
 * judge. Latin-script languages compare their own function words with the other languages'
 * ones; Russian counts Cyrillic words and Chinese counts Han characters (two per word)
 * against foreign function words.
 */
export function languageShare(text: string, lang: CoachLang): number | null {
  const words = (text.toLowerCase().match(WORD) ?? []) as string[];
  const ownSet = STOPWORDS[lang];
  let own = 0;
  let foreign = 0;
  for (const w of words) {
    if (ownSet?.has(w)) own++;
    else if (lang === "ru" && CYRILLIC_WORD.test(w)) own++;
    else if (
      Object.entries(STOPWORDS).some(([l, set]) => l !== lang && set!.has(w))
    )
      foreign++;
  }
  if (lang === "zh") own += Math.round((text.match(HAN)?.length ?? 0) / 2);
  return own + foreign < 8 ? null : own / (own + foreign);
}
/** True when an answer is clearly not in the requested language. */
export function offLanguage(text: string, lang: CoachLang): boolean {
  const share = languageShare(text, lang);
  return share !== null && share < (lang === "en" ? 0.4 : 0.5);
}

type Table = Record<CoachLang, string>;
type CountTable = Record<CoachLang, (n: number) => string>;
/** Fixed caveats the coach adds to an answer, in every output language. */
export const COACH_CAVEATS: {
  outputDropped: CountTable;
  offLanguage: Table;
  claimsDropped: CountTable;
  claimsCorrected: CountTable;
  unverified: Table;
  unusualOpponent: Table;
} = {
  outputDropped: {
    en: (n) =>
      `${n} part(s) of the AI answer were removed by the safety checks.`,
    pt: (n) =>
      `${n} parte(s) da resposta da IA foram removidas pelas verificações de segurança.`,
    es: (n) =>
      `Se eliminaron ${n} parte(s) de la respuesta de la IA en los controles de seguridad.`,
    ru: (n) => `Проверки безопасности удалили частей ответа ИИ: ${n}.`,
    zh: (n) => `安全检查移除了 AI 回答中的 ${n} 处内容。`,
    de: (n) =>
      `${n} Teil(e) der KI-Antwort wurden von den Sicherheitsprüfungen entfernt.`,
    fr: (n) =>
      `${n} partie(s) de la réponse de l'IA ont été retirées par les contrôles de sécurité.`,
    pl: (n) =>
      `Kontrole bezpieczeństwa usunęły fragmenty odpowiedzi AI (${n}).`,
    tr: (n) =>
      `Güvenlik kontrolleri yapay zekâ yanıtının ${n} bölümünü kaldırdı.`,
  },
  offLanguage: {
    en: "Part of the AI answer was not written in English.",
    pt: "Parte da resposta da IA veio em inglês em vez de português.",
    es: "Parte de la respuesta de la IA no está en español.",
    ru: "Часть ответа ИИ написана не на русском языке.",
    zh: "AI 回答中有部分内容不是简体中文。",
    de: "Ein Teil der KI-Antwort ist nicht auf Deutsch.",
    fr: "Une partie de la réponse de l'IA n'est pas en français.",
    pl: "Część odpowiedzi AI nie jest po polsku.",
    tr: "Yapay zekâ yanıtının bir kısmı Türkçe değil.",
  },
  claimsDropped: {
    en: (n) =>
      `${n} statement(s) were removed because the match data did not support them.`,
    pt: (n) =>
      `${n} afirmação(ões) foram removidas porque os dados da partida não as sustentam.`,
    es: (n) =>
      `Se eliminaron ${n} afirmación(es) porque los datos de la partida no las respaldan.`,
    ru: (n) =>
      `Удалено утверждений, которые не подтверждаются данными матча: ${n}.`,
    zh: (n) => `有 ${n} 条说法因比赛数据不支持而被删除。`,
    de: (n) =>
      `${n} Aussage(n) wurden entfernt, weil die Matchdaten sie nicht stützen.`,
    fr: (n) =>
      `${n} affirmation(s) ont été retirées car les données du match ne les confirment pas.`,
    pl: (n) =>
      `Usunięto stwierdzenia, których nie potwierdzają dane meczu: ${n}.`,
    tr: (n) => `Maç verileriyle desteklenmeyen ${n} ifade kaldırıldı.`,
  },
  claimsCorrected: {
    en: (n) => `${n} statement(s) were corrected to match the match data.`,
    pt: (n) =>
      `${n} afirmação(ões) foram corrigidas para bater com os dados da partida.`,
    es: (n) =>
      `Se corrigieron ${n} afirmación(es) para que coincidan con los datos de la partida.`,
    ru: (n) => `Исправлено утверждений по данным матча: ${n}.`,
    zh: (n) => `有 ${n} 条说法已按比赛数据更正。`,
    de: (n) => `${n} Aussage(n) wurden an die Matchdaten angepasst.`,
    fr: (n) =>
      `${n} affirmation(s) ont été corrigées pour correspondre aux données du match.`,
    pl: (n) => `Poprawiono stwierdzenia zgodnie z danymi meczu: ${n}.`,
    tr: (n) => `${n} ifade maç verilerine göre düzeltildi.`,
  },
  unverified: {
    en: "The second check of this review was unavailable; only the automatic number checks ran.",
    pt: "A segunda verificação desta análise não estava disponível; só as checagens automáticas de números foram feitas.",
    es: "La segunda verificación de este análisis no estuvo disponible; solo se hicieron las comprobaciones automáticas de números.",
    ru: "Вторая проверка этого разбора была недоступна; выполнены только автоматические проверки чисел.",
    zh: "本次复盘的二次核查不可用，只进行了自动数字核对。",
    de: "Die zweite Prüfung dieser Analyse war nicht verfügbar; nur die automatischen Zahlenprüfungen liefen.",
    fr: "La deuxième vérification de cette analyse n'était pas disponible ; seuls les contrôles automatiques des chiffres ont été faits.",
    pl: "Druga weryfikacja tej analizy była niedostępna; wykonano tylko automatyczne sprawdzenie liczb.",
    tr: "Bu analizin ikinci kontrolü kullanılamadı; yalnızca otomatik sayı kontrolleri yapıldı.",
  },
  unusualOpponent: {
    en: "Some deaths came from an opponent with statistically unusual aim / later banned; they weren't counted against you.",
    pt: "Algumas mortes vieram de um oponente com mira estatisticamente incomum / banido depois; elas não foram contadas contra você.",
    es: "Algunas muertes fueron ante un rival con una puntería estadísticamente inusual o baneado después; no se contaron en tu contra.",
    ru: "Часть смертей была от соперника со статистически необычным аимом или позже забаненного; они не засчитаны против тебя.",
    zh: "部分死亡来自瞄准数据异常或之后被封禁的对手，这些没有计入你的表现。",
    de: "Einige Tode kamen von einem Gegner mit statistisch ungewöhnlichem Aim oder späterem Bann; sie wurden nicht gegen dich gewertet.",
    fr: "Certaines morts viennent d'un adversaire à la visée statistiquement inhabituelle ou banni ensuite ; elles n'ont pas été comptées contre toi.",
    pl: "Część śmierci zadał przeciwnik o statystycznie nietypowym celowaniu lub później zbanowany; nie liczyły się na twoją niekorzyść.",
    tr: "Bazı ölümler istatistiksel olarak alışılmadık nişana sahip ya da sonradan banlanan bir rakipten geldi; aleyhine sayılmadı.",
  },
};
