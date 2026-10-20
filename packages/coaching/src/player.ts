import type { Analysis, Coaching } from "@cs2/contracts";

type Player = Analysis["players"][number];
type Metric = Player["adr"];
type Insight = Coaching["insights"][number];
const usable = (m: Metric | undefined): m is Metric =>
  !!m && m.complete && m.value !== null && Number.isFinite(m.value);
const round1 = (n: number) => Math.round(n * 10) / 10;
const list = (rounds: number[]): string =>
  rounds.length <= 1
    ? `round ${rounds[0]}`
    : `rounds ${rounds.slice(0, -1).join(", ")} and ${rounds.at(-1)}`;

/** Average of a complete metric across every player in the same demo. */
export function matchAverages(analysis: Analysis) {
  const avg = (pick: (p: Player) => Metric | undefined) => {
    const values = analysis.players
      .map(pick)
      .filter(usable)
      .map((m) => m.value!);
    return values.length
      ? round1(values.reduce((a, b) => a + b, 0) / values.length)
      : null;
  };
  return {
    players: analysis.players.length,
    adr: avg((p) => p.adr),
    headshotPercentage: avg((p) => p.headshotPercentage),
    kills: avg((p) => p.kills),
    deaths: avg((p) => p.deaths),
    kast: avg((p) => p.advanced?.kast),
    openingSuccess: avg((p) => p.advanced?.["opening-success"]),
    tradedDeaths: avg((p) => p.advanced?.["traded-deaths"]),
    accuracy: avg((p) => p.advanced?.accuracy),
    headshotHitRate: avg((p) => p.advanced?.["headshot-hit-rate"]),
    utilityDamagePerRound: avg((p) => p.advanced?.["utility-damage-per-round"]),
    enemiesFlashedPerRound: avg(
      (p) => p.advanced?.["enemies-flashed-per-round"],
    ),
    avgOpeningTime: avg((p) => p.advanced?.["avg-opening-time"]),
  };
}

import type { CoachLang } from "./languages.js";
export type { CoachLang };
const listPt = (rounds: number[]) =>
  rounds.length <= 1
    ? `round ${rounds[0]}`
    : `rounds ${rounds.slice(0, -1).join(", ")} e ${rounds.at(-1)}`;
type V = Record<string, string | number>;
const M = {
  en: {
    scope: () =>
      "Based on this demo only, compared with the other players in it.",
    openingBad: (v: V) => [
      `You lost ${v.lost} of ${v.total} opening duels and died first in ${v.rounds}. Each time your team was left playing 4v5.`,
      "Stop taking the first fight alone. Early in the round, hold an angle with a teammate close enough to trade, or use a flash before you peek. Re-watch those rounds and note where you were when you died.",
    ],
    openingGood: (v: V) => [
      `You won ${v.won} of ${v.total} opening duels (${v.rounds}), giving your team a 5v4 start.`,
      "Opening fights are a strength. Tell your team as soon as you get the pick so they can take map control off it.",
    ],
    untraded: (v: V) => [
      `Only ${v.traded} of your ${v.deaths} deaths ${v.traded === 1 ? "was" : "were"} traded by a teammate within 5 seconds. You died with nobody able to answer in ${v.rounds}.`,
      "Play within trade distance: stay close enough that a teammate can swing the angle right after you die. When you peek, call it out first so someone is ready.",
    ],
    tradeKills: (v: V) => [
      `You avenged teammates ${v.n} times by killing their killer within 5 seconds.`,
      "Good teamplay. Keep positioning next to your entry players so these trades keep happening.",
    ],
    kastBad: (v: V) => [
      `You had an impact (kill, damage assist, survival or being traded) in ${v.kast}% of rounds${v.avg !== "" ? `, versus a lobby average of ${v.avg}%` : ""}. Rounds with no impact: ${v.rounds}.`,
      "Aim to do one useful thing every round: deal damage with a grenade, stay alive to save your weapon, or die where a teammate can trade you.",
    ],
    kastGood: (v: V) => [
      `You were useful in ${v.kast}% of rounds (kill, damage assist, survival or traded death).`,
      "Your consistency is high. Next step: turn more of those rounds into multi-kills.",
    ],
    lostRounds: (v: V) => [
      `Your damage drops sharply in lost rounds: ${v.lost} ADR when your side lost versus ${v.won} when it won.`,
      "In rounds that start badly, don't go passive. Look for a damage trade with a grenade or play for a late pick with a teammate instead of waiting alone.",
    ],
    side: (v: V) => [
      `You were much stronger on ${v.strong} (${v.strongAdr} ADR) than on ${v.weak} (${v.weakAdr} ADR).`,
      `Focus your next practice on the ${v.weak} side: learn one default position and two utility throws for it on this map.`,
    ],
    clutch: (v: V) => [
      `You were last alive in ${v.n} round${Number(v.n) > 1 ? "s" : ""} (${v.rounds}) and won ${v.won}.`,
      Number(v.won) > 0
        ? "Clutching is a strength. Keep playing for time and isolated duels in these spots."
        : "In clutches, slow down: use the clock, avoid fighting two enemies at once, and fight from angles where only one enemy can see you.",
    ],
    multi: (v: V) => [
      `You won ${v.n} rounds with multiple kills (${v.rounds}).`,
      "You can take over rounds. Re-watch these rounds and repeat the setup that led to them.",
    ],
    zero: (v: V) => [
      `You dealt no damage in ${v.n} of ${v.total} rounds (${v.rounds}).`,
      "Every round, throw at least one damaging grenade (HE or molotov) into a common enemy spot, even if you don't see anyone.",
    ],
    adrHigh: (v: V) => [
      `You dealt ${v.adr} damage per round, well above the lobby average of ${v.avg}.`,
      "Your damage output carried rounds. Make sure it turns into kills: trade with teammates who are finishing low-health enemies.",
    ],
    adrLow: (v: V) => [
      `You dealt ${v.adr} damage per round, below the lobby average of ${v.avg}.`,
      "Get involved earlier: play closer to your team's main fights and use utility damage instead of waiting for enemies to come to you.",
    ],
    hsLow: (v: V) => [
      `Only ${v.hs} of your ${v.kills} kills were headshots (${v.pct}%).`,
      "Spend 10 minutes before each match on crosshair placement: keep the crosshair at head height around common angles in deathmatch.",
    ],
    hsHigh: (v: V) => [
      `${v.hs} of your ${v.kills} kills were headshots (${v.pct}%).`,
      "Your aim is precise. Spend practice time on utility and positioning instead.",
    ],
    deathSpot: (v: V) => [
      `${v.n} of your ${v.deaths} deaths were at ${v.place}${Number(v.early) > 0 ? ` (${v.early} of them in the first 20 seconds of the round)` : ""}: ${v.rounds}.`,
      `You keep losing the same fight at ${v.place}. Next time, change something before you get there: use a flash or smoke first, take a different angle, or wait for a teammate so the death can at least be traded.`,
    ],
    earlyDeaths: (v: V) => [
      `You died in the first 20 seconds of the round ${v.n} times out of ${v.deaths} deaths (${v.rounds}).`,
      "Early deaths leave your team short before the round has started. In the first 20 seconds, hold a safe angle or gather information with a teammate instead of taking a dry peek.",
    ],
    weaponGap: (v: V) => [
      `Your ${v.weak} accuracy was ${v.weakAcc}% (${v.weakShots} shots) versus ${v.strongAcc}% with the ${v.strong} (${v.strongShots} shots).`,
      `Practise the ${v.weak} specifically: 10 minutes of spray-transfer and burst drills with it before matches, and avoid long sprays at range with it.`,
    ],
    accuracyLow: (v: V) => [
      `Only ${v.acc}% of your ${v.shots} shots hit an enemy, below the lobby average of ${v.avg}%.`,
      "Shoot fewer, better bullets: stop before shooting, fire short bursts at range and reset your crosshair between bursts instead of holding the spray.",
    ],
    accuracyHigh: (v: V) => [
      `${v.acc}% of your ${v.shots} shots hit an enemy, above the lobby average of ${v.avg}%.`,
      "Your shooting is efficient. Use that by taking more duels where your team can trade you.",
    ],
    lowHits: (v: V) => [
      `${v.pct}% of your ${v.total} gun hits landed on the stomach or legs and only ${v.head} on the head.`,
      "Your crosshair sits too low. In deathmatch and while clearing angles, keep it at head height; check it every time you stop moving.",
    ],
    utilityLow: (v: V) => [
      `You used ${v.nades} grenades in ${v.rounds} rounds and flashed ${v.enemies} enemies.`,
      "Buy and throw your utility every round: one flash or molotov for the space your team is taking, before the fight, not after you die.",
    ],
    teamFlash: (v: V) => [
      `Your flashes blinded ${v.team} teammates and only ${v.enemies} enemies.`,
      "Call your flashes before throwing and learn pop-flashes for your usual positions so they burst behind the corner, not in your team's face.",
    ],
    antiEco: (v: V) => [
      `Your side lost ${v.lost} of ${v.total} anti-eco rounds (the enemy on an eco, your side much better equipped).`,
      "Against an eco, play for trades and distance: don't peek short angles alone where pistols and shotguns win, and stay together so their kills are traded.",
    ],
    roundK: (v: V) => `round ${v.r}: ${v.k}K`,
    roundClutch: (v: V) => `round ${v.r} 1v${v.vs}`,
    list,
  },
  pt: {
    scope: () =>
      "Baseado apenas nesta demo, comparado com os outros jogadores dela.",
    openingBad: (v: V) => [
      `Você perdeu ${v.lost} de ${v.total} duelos de abertura e morreu primeiro nos ${v.rounds}. Em cada um deles seu time ficou jogando 4v5.`,
      "Pare de pegar a primeira troca sozinho. No início do round, segure um ângulo com um companheiro perto o bastante para trocar, ou use uma flash antes de dar o peek. Reveja esses rounds e anote onde você estava quando morreu.",
    ],
    openingGood: (v: V) => [
      `Você venceu ${v.won} de ${v.total} duelos de abertura (${v.rounds}), dando ao time um início 5v4.`,
      "Duelos de abertura são um ponto forte. Avise o time assim que pegar o abate para eles tomarem o mapa a partir disso.",
    ],
    untraded: (v: V) => [
      `Só ${v.traded} das suas ${v.deaths} mortes ${v.traded === 1 ? "foi trocada" : "foram trocadas"} por um companheiro em até 5 segundos. Você morreu sem ninguém para responder nos ${v.rounds}.`,
      "Jogue a uma distância de troca: fique perto o bastante para um companheiro abrir o ângulo logo depois que você morrer. Antes de dar o peek, avise para alguém estar pronto.",
    ],
    tradeKills: (v: V) => [
      `Você vingou companheiros ${v.n} vezes, matando quem os matou em até 5 segundos.`,
      "Bom jogo em equipe. Continue se posicionando perto de quem entra primeiro para essas trocas continuarem acontecendo.",
    ],
    kastBad: (v: V) => [
      `Você teve impacto (abate, assistência de dano, sobrevivência ou morte trocada) em ${v.kast}% dos rounds${v.avg !== "" ? `, contra uma média de ${v.avg}% no lobby` : ""}. Rounds sem impacto: ${v.rounds}.`,
      "Tente fazer algo útil em todo round: causar dano com uma granada, sobreviver para salvar a arma ou morrer onde um companheiro possa trocar.",
    ],
    kastGood: (v: V) => [
      `Você foi útil em ${v.kast}% dos rounds (abate, assistência de dano, sobrevivência ou morte trocada).`,
      "Sua consistência é alta. Próximo passo: transformar mais desses rounds em multi-kills.",
    ],
    lostRounds: (v: V) => [
      `Seu dano cai muito nos rounds perdidos: ${v.lost} de ADR quando seu lado perdeu, contra ${v.won} quando ganhou.`,
      "Em rounds que começam mal, não fique passivo. Busque uma troca de dano com granada ou jogue por um abate tardio junto de um companheiro, em vez de esperar sozinho.",
    ],
    side: (v: V) => [
      `Você foi bem mais forte de ${v.strong} (${v.strongAdr} de ADR) do que de ${v.weak} (${v.weakAdr} de ADR).`,
      `Foque o próximo treino no lado ${v.weak}: aprenda uma posição padrão e duas granadas para ela neste mapa.`,
    ],
    clutch: (v: V) => [
      `Você foi o último vivo em ${v.n} round${Number(v.n) > 1 ? "s" : ""} (${v.rounds}) e venceu ${v.won}.`,
      Number(v.won) > 0
        ? "Clutch é um ponto forte. Continue jogando pelo tempo e buscando duelos isolados nessas situações."
        : "No clutch, vá com calma: use o relógio, evite lutar contra dois ao mesmo tempo e escolha ângulos onde só um inimigo te vê.",
    ],
    multi: (v: V) => [
      `Você fez ${v.n} rounds com vários abates (${v.rounds}).`,
      "Você consegue decidir rounds. Reveja esses rounds e repita o posicionamento que levou a eles.",
    ],
    zero: (v: V) => [
      `Você não causou dano em ${v.n} de ${v.total} rounds (${v.rounds}).`,
      "Em todo round, jogue pelo menos uma granada de dano (HE ou molotov) num ponto comum dos inimigos, mesmo sem ver ninguém.",
    ],
    adrHigh: (v: V) => [
      `Você causou ${v.adr} de dano por round, bem acima da média do lobby (${v.avg}).`,
      "Seu dano carregou rounds. Garanta que ele vire abates: troque com companheiros que estão finalizando inimigos com pouca vida.",
    ],
    adrLow: (v: V) => [
      `Você causou ${v.adr} de dano por round, abaixo da média do lobby (${v.avg}).`,
      "Entre nas lutas mais cedo: jogue perto das trocas principais do time e use granadas de dano em vez de esperar os inimigos virem até você.",
    ],
    hsLow: (v: V) => [
      `Só ${v.hs} dos seus ${v.kills} abates foram headshots (${v.pct}%).`,
      "Gaste 10 minutos antes de cada partida treinando posicionamento de mira: deixe a mira na altura da cabeça nos ângulos comuns, no deathmatch.",
    ],
    hsHigh: (v: V) => [
      `${v.hs} dos seus ${v.kills} abates foram headshots (${v.pct}%).`,
      "Sua mira é precisa. Use o tempo de treino em granadas e posicionamento.",
    ],
    deathSpot: (v: V) => [
      `${v.n} das suas ${v.deaths} mortes foram em ${v.place}${Number(v.early) > 0 ? ` (${v.early} delas nos primeiros 20 segundos do round)` : ""}: ${v.rounds}.`,
      `Você está perdendo a mesma luta em ${v.place}. Da próxima vez, mude algo antes de chegar lá: use uma flash ou smoke primeiro, pegue outro ângulo ou espere um companheiro para a morte pelo menos ser trocada.`,
    ],
    earlyDeaths: (v: V) => [
      `Você morreu nos primeiros 20 segundos do round ${v.n} vezes em ${v.deaths} mortes (${v.rounds}).`,
      "Mortes cedo deixam o time em desvantagem antes do round começar. Nos primeiros 20 segundos, segure um ângulo seguro ou colete informação junto de um companheiro em vez de dar peek seco.",
    ],
    weaponGap: (v: V) => [
      `Sua precisão com a ${v.weak} foi ${v.weakAcc}% (${v.weakShots} tiros), contra ${v.strongAcc}% com a ${v.strong} (${v.strongShots} tiros).`,
      `Treine a ${v.weak} especificamente: 10 minutos de transferência de spray e rajadas com ela antes das partidas, e evite sprays longos à distância com ela.`,
    ],
    accuracyLow: (v: V) => [
      `Só ${v.acc}% dos seus ${v.shots} tiros acertaram um inimigo, abaixo da média do lobby (${v.avg}%).`,
      "Atire menos e melhor: pare antes de atirar, use rajadas curtas à distância e reposicione a mira entre as rajadas em vez de segurar o spray.",
    ],
    accuracyHigh: (v: V) => [
      `${v.acc}% dos seus ${v.shots} tiros acertaram um inimigo, acima da média do lobby (${v.avg}%).`,
      "Seu tiro é eficiente. Aproveite pegando mais duelos onde o time consegue te trocar.",
    ],
    lowHits: (v: V) => [
      `${v.pct}% dos seus ${v.total} acertos com arma foram no estômago ou nas pernas e só ${v.head} na cabeça.`,
      "Sua mira está baixa. No deathmatch e ao limpar ângulos, mantenha a mira na altura da cabeça; confira toda vez que parar de andar.",
    ],
    utilityLow: (v: V) => [
      `Você usou ${v.nades} granadas em ${v.rounds} rounds e cegou ${v.enemies} inimigos.`,
      "Compre e use suas granadas todo round: uma flash ou molotov para o espaço que o time está tomando, antes da luta, não depois de morrer.",
    ],
    teamFlash: (v: V) => [
      `Suas flashes cegaram ${v.team} companheiros e só ${v.enemies} inimigos.`,
      "Avise antes de jogar a flash e aprenda pop-flashes para suas posições comuns, para elas estourarem atrás da quina e não na cara do seu time.",
    ],
    antiEco: (v: V) => [
      `Seu lado perdeu ${v.lost} de ${v.total} rounds anti-eco (o inimigo em eco e seu lado muito mais equipado).`,
      "Contra eco, jogue por troca e distância: não dê peek sozinho em ângulos curtos onde pistolas e escopetas ganham, e fique junto para as mortes serem trocadas.",
    ],
    roundK: (v: V) => `round ${v.r}: ${v.k}K`,
    roundClutch: (v: V) => `round ${v.r} 1v${v.vs}`,
    list: listPt,
  },
};

type Scored = Insight & { weight: number };

/**
 * Deterministic coach for one player. Rules only fire on complete metrics, every insight
 * cites that player's own evidence, and match averages are context that is never cited.
 */
export function playerInsights(
  analysis: Analysis,
  steamId: string,
  lang: CoachLang = "en",
  /** Return every rule that fired (ordered by priority) instead of the top selection. */
  all = false,
): Insight[] {
  // Offline rule texts exist in English and Portuguese (they are not shown in the app).
  const L = lang === "pt" ? M.pt : M.en;
  // Portuguese uses a decimal comma.
  const localize = (text: string) =>
    lang === "pt" ? text.replace(/(\d)\.(\d)/g, "$1,$2") : text;
  const p = analysis.players.find((x) => x.steamId === steamId);
  if (!p) return [];
  const avg = matchAverages(analysis);
  const a = p.advanced ?? {};
  const rows = p.rounds ?? [];
  const scope = L.scope();
  const out: Scored[] = [];
  const add = (
    kind: "strength" | "improve",
    weight: number,
    metrics: (Metric | undefined)[],
    [observation, actionablePractice]: string[],
    confidence: Insight["confidence"],
    caveats: string[] = [scope],
  ) => {
    const evidenceIds = metrics.filter(usable).flatMap((m) => m.evidenceIds);
    if (evidenceIds.length)
      out.push({
        kind,
        weight,
        observation: localize(observation!),
        actionablePractice: localize(actionablePractice!),
        confidence,
        evidenceIds,
        caveats,
      });
  };

  // Opening duels decide most rounds: the team that loses the first player plays 4v5.
  const os = a["opening-success"];
  const firstDeaths = rows.filter((r) => r.opening === "death");
  const firstKills = rows.filter((r) => r.opening === "kill");
  if (usable(os) && os.denominator >= 3) {
    if (os.value! < 40)
      add(
        "improve",
        3,
        [os],
        L.openingBad({
          lost: firstDeaths.length,
          total: os.denominator,
          rounds: L.list(firstDeaths.map((r) => r.round)),
        }),
        os.denominator >= 5 ? "medium" : "low",
      );
    else if (os.value! >= 60)
      add(
        "strength",
        2,
        [os],
        L.openingGood({
          won: firstKills.length,
          total: os.denominator,
          rounds: L.list(firstKills.map((r) => r.round)),
        }),
        os.denominator >= 5 ? "medium" : "low",
      );
  }

  // Trades: dying where nobody can avenge you wastes the death.
  const td = a["traded-deaths"];
  const untraded = rows.filter((r) => r.died && !r.traded);
  if (usable(td) && td.denominator >= 4 && td.value! < 30)
    add(
      "improve",
      3,
      [td],
      L.untraded({
        traded: td.numerator,
        deaths: td.denominator,
        rounds: L.list(untraded.map((r) => r.round)),
      }),
      "medium",
    );
  const tk = a["trade-kills"];
  if (usable(tk) && tk.value! >= 3)
    add("strength", 1, [tk], L.tradeKills({ n: tk.value! }), "medium");

  // KAST: share of rounds where you contributed anything at all.
  const kast = a.kast;
  const silent = rows.filter(
    (r) => r.kills === 0 && !r.damageAssist && r.died && !r.traded,
  );
  if (usable(kast)) {
    if (kast.value! < 60)
      add(
        "improve",
        4,
        [kast],
        L.kastBad({
          kast: kast.value!,
          avg: avg.kast ?? "",
          rounds: L.list(silent.map((r) => r.round)),
        }),
        "medium",
      );
    else if (kast.value! >= 75)
      add("strength", 1, [kast], L.kastGood({ kast: kast.value! }), "medium");
  }

  // Damage in winning vs losing rounds shows whether you show up when the team struggles.
  const won = a["adr-won"];
  const lost = a["adr-lost"];
  if (
    usable(won) &&
    usable(lost) &&
    won.denominator >= 2 &&
    lost.denominator >= 2
  ) {
    if (lost.value! < won.value! * 0.5)
      add(
        "improve",
        2,
        [won, lost],
        L.lostRounds({ lost: lost.value!, won: won.value! }),
        "low",
      );
  }

  // Side split.
  const ct = a["adr-ct"];
  const t = a["adr-t"];
  if (usable(ct) && usable(t) && ct.denominator >= 3 && t.denominator >= 3) {
    const [weak, strong, weakName, strongName] =
      ct.value! < t.value! ? [ct, t, "CT", "T"] : [t, ct, "T", "CT"];
    if (weak.value! < strong.value! * 0.6)
      add(
        "improve",
        2,
        [ct, t],
        L.side({
          strong: strongName,
          strongAdr: strong.value!,
          weak: weakName,
          weakAdr: weak.value!,
        }),
        "low",
      );
  }

  // Clutches.
  const cl = a["clutch-wins"];
  const clutchRounds = rows.filter((r) => r.clutchVs);
  const winnable = clutchRounds.some((r) => r.clutchVs! <= 2);
  if (cl && cl.complete && cl.denominator > 0 && (cl.numerator > 0 || winnable))
    add(
      cl.numerator > 0 ? "strength" : "improve",
      cl.numerator > 0 ? 2 : 1,
      [{ ...cl, value: cl.value ?? 0 }],
      L.clutch({
        n: cl.denominator,
        won: cl.numerator,
        rounds: clutchRounds
          .map((r) => L.roundClutch({ r: r.round, vs: r.clutchVs! }))
          .join(", "),
      }),
      "low",
    );

  // Multi-kills.
  const mk = a["multi-kill-rounds"];
  const multi = rows.filter((r) => r.kills >= 2);
  if (usable(mk) && mk.value! >= 2)
    add(
      "strength",
      2,
      [mk],
      L.multi({
        n: mk.value!,
        rounds: multi
          .map((r) => L.roundK({ r: r.round, k: r.kills }))
          .join(", "),
      }),
      "medium",
    );

  // Rounds with no damage at all.
  const zd = a["zero-damage-rounds"];
  const zero = rows.filter((r) => r.damage === 0);
  if (usable(zd) && rows.length >= 5 && zd.value! / rows.length >= 0.4)
    add(
      "improve",
      2,
      [zd],
      L.zero({
        n: zd.value!,
        total: rows.length,
        rounds: L.list(zero.map((r) => r.round)),
      }),
      "medium",
    );

  // Raw damage vs lobby.
  if (usable(p.adr) && avg.adr !== null && avg.adr > 0) {
    const ratio = p.adr.value! / avg.adr;
    if (ratio >= 1.25)
      add(
        "strength",
        3,
        [p.adr],
        L.adrHigh({ adr: p.adr.value!, avg: avg.adr }),
        "medium",
      );
    else if (ratio <= 0.75)
      add(
        "improve",
        3,
        [p.adr],
        L.adrLow({ adr: p.adr.value!, avg: avg.adr }),
        "medium",
      );
  }

  // Headshots.
  const hs = p.headshotPercentage;
  if (usable(hs) && hs.denominator >= 5) {
    if (hs.value! < 30)
      add(
        "improve",
        1,
        [hs],
        L.hsLow({ hs: hs.numerator, kills: hs.denominator, pct: hs.value! }),
        hs.denominator >= 8 ? "medium" : "low",
      );
    else if (hs.value! >= 60)
      add(
        "strength",
        1,
        [hs],
        L.hsHigh({ hs: hs.numerator, kills: hs.denominator, pct: hs.value! }),
        hs.denominator >= 8 ? "medium" : "low",
      );
  }

  // Detailed breakdowns (parser cs2live.2+): weapons, callouts, hit groups, timing, utility,
  // economy. Each rule cites the breakdown evidence entry it is built from.
  const d = p.detail;
  const fact = (id: string | undefined): Metric | undefined => {
    const e = id ? analysis.evidence.find((x) => x.id === id) : undefined;
    return e && e.value !== undefined && Number.isFinite(e.value)
      ? {
          value: e.value,
          numerator: e.value,
          denominator: 1,
          complete: true,
          formula: e.kind,
          evidenceIds: [e.id],
        }
      : undefined;
  };
  const factOfKind = (kind: string) =>
    fact(
      d?.evidenceIds?.find(
        (id) => analysis.evidence.find((e) => e.id === id)?.kind === kind,
      ),
    );
  const deathsTotal = usable(p.deaths) ? p.deaths.value! : 0;

  // The same callout keeps killing you.
  if (d?.places && deathsTotal >= 3) {
    const spot = [...d.places]
      .filter((pl) => pl.evidenceId)
      .sort((x, y) => y.deaths - x.deaths)[0];
    if (spot && spot.deaths >= 3 && spot.deaths / deathsTotal >= 0.4) {
      const there = rows.filter((r) => r.died && r.deathPlace === spot.place);
      add(
        "improve",
        4,
        [fact(spot.evidenceId), p.deaths],
        L.deathSpot({
          n: spot.deaths,
          deaths: deathsTotal,
          place: spot.place,
          early: there.filter((r) => (r.deathTime ?? Infinity) < 20).length,
          rounds: L.list(there.map((r) => r.round)),
        }),
        spot.deaths >= 4 ? "medium" : "low",
      );
    }
  }

  // Dying in the first 20 seconds.
  const ed = a["early-deaths"];
  if (
    usable(ed) &&
    deathsTotal >= 4 &&
    ed.value! >= 3 &&
    ed.value! / deathsTotal >= 0.4
  ) {
    const early = rows.filter((r) => r.died && (r.deathTime ?? Infinity) < 20);
    add(
      "improve",
      3,
      [ed],
      L.earlyDeaths({
        n: ed.value!,
        deaths: deathsTotal,
        rounds: L.list(early.map((r) => r.round)),
      }),
      "medium",
    );
  }

  // Accuracy by weapon: a large gap between two guns used a lot.
  const guns = (d?.weapons ?? [])
    .filter((w) => w.shots >= 15 && w.evidenceId)
    .map((w) => ({ w, f: fact(w.evidenceId) }))
    .filter((x): x is { w: typeof x.w; f: Metric } => usable(x.f))
    .sort((x, y) => x.f.value! - y.f.value!);
  if (guns.length >= 2) {
    const weak = guns[0]!;
    const strong = guns.at(-1)!;
    if (strong.f.value! - weak.f.value! >= 10)
      add(
        "improve",
        2,
        [weak.f, strong.f],
        L.weaponGap({
          weak: weak.w.weapon,
          weakAcc: weak.f.value!,
          weakShots: weak.w.shots,
          strong: strong.w.weapon,
          strongAcc: strong.f.value!,
          strongShots: strong.w.shots,
        }),
        weak.w.shots >= 40 ? "medium" : "low",
      );
  }

  // Overall accuracy vs lobby.
  const acc = a.accuracy;
  if (
    usable(acc) &&
    acc.denominator >= 40 &&
    avg.accuracy !== null &&
    avg.accuracy > 0
  ) {
    const ratio = acc.value! / avg.accuracy;
    if (ratio <= 0.7)
      add(
        "improve",
        2,
        [acc],
        L.accuracyLow({
          acc: acc.value!,
          shots: acc.denominator,
          avg: avg.accuracy,
        }),
        acc.denominator >= 100 ? "medium" : "low",
      );
    else if (ratio >= 1.3)
      add(
        "strength",
        2,
        [acc],
        L.accuracyHigh({
          acc: acc.value!,
          shots: acc.denominator,
          avg: avg.accuracy,
        }),
        acc.denominator >= 100 ? "medium" : "low",
      );
  }

  // Hits landing low: crosshair placement.
  const hg = factOfKind("hitgroups");
  const groups = d?.hitgroups;
  if (hg && groups) {
    const total = Object.values(groups).reduce((n, x) => n + (x ?? 0), 0);
    if (total >= 10 && hg.value! >= 40)
      add(
        "improve",
        2,
        [hg],
        L.lowHits({
          pct: Math.round(hg.value!),
          total,
          head: groups.head ?? 0,
        }),
        total >= 25 ? "medium" : "low",
      );
  }

  // Utility.
  const util = d?.utility;
  const utilFact = factOfKind("utility");
  if (util && utilFact && rows.length >= 6) {
    const nades = util.flashes + util.smokes + util.hes + util.molotovs;
    if (nades / rows.length < 1)
      add(
        "improve",
        2,
        [utilFact, a["enemies-flashed-per-round"]],
        L.utilityLow({
          nades,
          rounds: rows.length,
          enemies: util.enemiesFlashed,
        }),
        "medium",
      );
    if (
      util.teammatesFlashed >= 3 &&
      util.teammatesFlashed > util.enemiesFlashed
    )
      add(
        "improve",
        2,
        [utilFact],
        L.teamFlash({
          team: util.teammatesFlashed,
          enemies: util.enemiesFlashed,
        }),
        "medium",
      );
  }

  // Anti-eco rounds lost.
  const ae = a["anti-eco-win-rate"];
  if (usable(ae) && ae.denominator >= 2 && ae.value! < 50)
    add(
      "improve",
      2,
      [ae],
      L.antiEco({ lost: ae.denominator - ae.numerator, total: ae.denominator }),
      "low",
    );

  // Keep the most important points, balancing what to fix with what went well.
  const pick = (kind: "strength" | "improve", n: number) =>
    out
      .filter((i) => i.kind === kind)
      .sort((x, y) => y.weight - x.weight)
      .slice(0, n);
  const improve = pick("improve", all ? out.length : 5);
  const strengths = pick("strength", all ? out.length : 8 - improve.length);
  return [...improve, ...strengths].map((scored) => {
    const insight: Partial<Scored> = { ...scored };
    delete insight.weight;
    return insight as Insight;
  });
}

export function offlinePlayerCoaching(
  analysis: Analysis,
  steamId: string,
  lang: CoachLang = "en",
): Coaching {
  const insights = playerInsights(analysis, steamId, lang);
  return {
    schemaVersion: "1.0",
    mode: "offline",
    provenance: { promptVersion: "deterministic-player-v3" },
    insights,
    caveats: [
      ...analysis.caveats,
      lang === "pt"
        ? "Feedback determinístico offline; nenhum modelo de linguagem foi chamado."
        : "Offline deterministic feedback; no language model was called.",
      ...(insights.length
        ? []
        : [
            lang === "pt"
              ? "Não há evidência completa suficiente deste jogador para dar feedback."
              : "Not enough complete evidence for this player to give feedback.",
          ]),
    ],
  };
}
