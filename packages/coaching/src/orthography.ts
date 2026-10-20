/**
 * Orthography check for model answers. Some models drop diacritics ("nao", "posicao") when
 * writing JSON. A few common accent-less forms in a language that needs accents trigger one
 * retry with a stronger reminder; if the answer is still accent-less, a small whole-word map
 * restores the most frequent words (case kept). Only unambiguous forms are listed: words that
 * are also correct without the accent ("esta", "e", "so", the verb "analise") are left out.
 */
import type { GuardSpec } from "./security.js";

const words = (pairs: string): Record<string, string> =>
  Object.fromEntries(
    pairs
      .trim()
      .split(/\s+/)
      .map((p) => p.split("=") as [string, string]),
  );

/** Accent-less form → correct spelling, per language (lowercase). */
export const ACCENTLESS: Record<string, Record<string, string>> = {
  pt: words(`
    nao=não sao=são voce=você voces=vocês posicao=posição posicoes=posições tambem=também
    ja=já ate=até apos=após organizacao=organização informacao=informação informacoes=informações
    frequencia=frequência varias=várias varios=vários numero=número numeros=números rapido=rápido
    rapida=rápida rapidos=rápidos rapidas=rápidas entao=então decisao=decisão decisoes=decisões
    proximo=próximo proxima=próxima proximos=próximos proximas=próximas pressao=pressão
    situacao=situação situacoes=situações rotacao=rotação rotacoes=rotações execucao=execução
    comunicacao=comunicação atencao=atenção funcao=função mao=mão tres=três porem=porém alem=além
    nivel=nível possivel=possível facil=fácil dificil=difícil unico=único unica=única ultimo=último
    ultima=última ultimos=últimos ultimas=últimas  tatica=tática taticas=táticas historico=histórico seguranca=segurança
    forca=força comeco=começo periodo=período  minimo=mínimo
    maximo=máximo area=área areas=áreas angulo=ângulo angulos=ângulos eficiencia=eficiência
    consistencia=consistência experiencia=experiência ninguem=ninguém alguem=alguém sera=será
    precisao=precisão transicao=transição direcao=direção conexao=conexão utilitaria=utilitária
    utilitarias=utilitárias medio=médio sequencia=sequência
    pos-plant=pós-plant pos-round=pós-round sobrevivencia=sobrevivência visao=visão
    economica=econômica economico=econômico media=média
  `),
  es: words(`
    tambien=también despues=después rapido=rápido rapida=rápida posicion=posición
     informacion=información decision=decisión situacion=situación
    ultimo=último ultima=última proximo=próximo proxima=próxima numero=número tactica=táctica facil=fácil dificil=difícil angulo=ángulo angulos=ángulos rotacion=rotación
    comunicacion=comunicación presion=presión economia=economía debil=débil aqui=aquí asi=así
    ademas=además dano=daño tecnica=técnica rapidamente=rápidamente
  `),
  fr: words(`
    deja=déjà tres=très equipe=équipe equipes=équipes probleme=problème etait=était etre=être
    apres=après deuxieme=deuxième premiere=première precision=précision strategie=stratégie
    reussi=réussi degats=dégâts eviter=éviter evite=évite controle=contrôle derniere=dernière
    regle=règle elimination=élimination echange=échange echanges=échanges ecart=écart
    debut=début reperer=repérer prepare=prépare preparer=préparer
  `),
  de: words(`
    fur=für fuer=für uber=über ueber=über moglich=möglich konnen=können mussen=müssen
    zuruck=zurück nachste=nächste nachsten=nächsten spater=später wahrend=während
    haufig=häufig ofter=öfter dafur=dafür fruh=früh fruher=früher uberlebt=überlebt
    zuverlassig=zuverlässig standig=ständig gegenuber=gegenüber
  `),
  pl: words(`
    sie=się mozesz=możesz wiecej=więcej zeby=żeby bedzie=będzie takze=także wlasnie=właśnie
    rowniez=również smierc=śmierć smierci=śmierci gdzies=gdzieś zrob=zrób uzyj=użyj
    uzywaj=używaj druzyna=drużyna druzyny=drużyny nastepny=następny nastepnej=następnej
    probuj=próbuj czesto=często wczesnie=wcześnie pozniej=później miedzy=między
  `),
  tr: words(`
    icin=için degil=değil cok=çok olum=ölüm olumler=ölümler ustunluk=üstünlük takim=takım
    takimin=takımın takiminla=takımınla atis=atış nisan=nişan dogru=doğru gore=göre
    dusman=düşman simdi=şimdi bolge=bölge calis=çalış calisma=çalışma kotu=kötü guclu=güçlü
    zayif=zayıf
  `),
};

const WORD = /(?<![\p{L}\p{N}_])[\p{L}][\p{L}-]*(?![\p{L}\p{N}_])/gu;

/** Accent-less words found in `text` for `lang` (each occurrence counted). */
export function accentlessCount(text: string, lang: string): number {
  const map = ACCENTLESS[lang];
  if (!map) return 0;
  let n = 0;
  for (const m of text.matchAll(WORD)) if (map[m[0].toLowerCase()]) n++;
  return n;
}
/** True when the text has at least `min` accent-less forms (default 2). */
export const lacksDiacritics = (text: string, lang: string, min = 2) =>
  accentlessCount(text, lang) >= min;

const keepCase = (source: string, fixed: string) =>
  source === source.toUpperCase() && source.length > 1
    ? fixed.toUpperCase()
    : source[0] === source[0]!.toUpperCase()
      ? fixed[0]!.toUpperCase() + fixed.slice(1)
      : fixed;
/** Restores the listed words (whole words only, case kept). */
export function restoreDiacritics(text: string, lang: string): string {
  const map = ACCENTLESS[lang];
  if (!map) return text;
  return text.replace(WORD, (w) => {
    const fixed = map[w.toLowerCase()];
    return fixed ? keepCase(w, fixed) : w;
  });
}

/** Applies `fn` to every human-readable string the guard spec names (returns a copy). */
export function mapSpecStrings(
  data: unknown,
  spec: GuardSpec,
  fn: (s: string) => string,
): unknown {
  const isObj = (v: unknown): v is Record<string, unknown> =>
    typeof v === "object" && v !== null && !Array.isArray(v);
  const visit = (obj: Record<string, unknown>, s: GuardSpec) => {
    const out: Record<string, unknown> = { ...obj };
    for (const f of s.fields ?? [])
      if (typeof out[f] === "string") out[f] = fn(out[f] as string);
    for (const l of s.lists ?? [])
      if (Array.isArray(out[l]))
        out[l] = (out[l] as unknown[]).map((x) =>
          typeof x === "string" ? fn(x) : x,
        );
    for (const [k, child] of Object.entries(s.items ?? {}))
      if (Array.isArray(out[k]))
        out[k] = (out[k] as unknown[]).map((x) =>
          isObj(x) ? visit(x, child) : x,
        );
    return out;
  };
  return isObj(data) ? visit(data, spec) : data;
}
/** All human-readable strings of an answer, joined (for language checks). */
export function specText(data: unknown, spec: GuardSpec): string {
  const parts: string[] = [];
  mapSpecStrings(data, spec, (s) => {
    parts.push(s);
    return s;
  });
  return parts.join(" ");
}

const NAMES: Record<string, string> = {
  pt: "Brazilian Portuguese",
  es: "Spanish",
  fr: "French",
  de: "German",
  pl: "Polish",
  tr: "Turkish",
};
/** Stronger system line for the one retry after an accent-less answer. */
export function orthographyReminder(lang: string): string {
  const examples = Object.entries(ACCENTLESS[lang] ?? {})
    .slice(0, 4)
    .map(([bad, good]) => `"${good}" (never "${bad}")`)
    .join(", ");
  return `\n\nORTHOGRAPHY (mandatory): a previous answer to this request was written without accents. Write correct ${NAMES[lang] ?? "native"} spelling with every accent and special letter, for example ${examples}.`;
}
