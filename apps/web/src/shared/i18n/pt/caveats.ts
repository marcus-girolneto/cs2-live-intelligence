// Portuguese (Brazil) versions of the fixed caveats written by packages/analytics and
// packages/coaching (shown in reports through t()).
export const ptCaveats: Record<string, string> = {
  "The demo has incomplete round coverage or inconsistent event participation. Metrics abstain.":
    "A demo não cobre todos os rounds ou tem eventos inconsistentes. As métricas ficam de fora.",
  "Some attacker, victim or team identities are unresolved. Combat metrics abstain.":
    "Algumas identidades de atacante, vítima ou time não foram resolvidas. As métricas de combate ficam de fora.",
  "Damage coverage is incomplete; ADR is unavailable.":
    "Os dados de dano estão incompletos; o ADR não está disponível.",
  "Kill coverage is incomplete; kill, death and headshot metrics are unavailable.":
    "Os dados de abates estão incompletos; as métricas de abates, mortes e headshots não estão disponíveis.",
  "Economy is sampled when freeze time ends; items bought later in the buy period are not included.":
    "A economia é registrada no fim do freeze time; itens comprados depois, ainda no tempo de compra, não entram.",
  "No player identity is linked to this account, so no match could be attributed.":
    "Nenhuma identidade de jogador está ligada a esta conta, então nenhuma partida pôde ser atribuída.",
  "No analyzed matches in this period.":
    "Nenhuma partida analisada neste período.",
  "No deep reviews in this period: utility and crosshair evolution need deep reviews.":
    "Nenhuma review profunda neste período: a evolução de utilitárias e mira precisa de reviews profundas.",
  "No analyzed match contains this player yet.":
    "Nenhuma partida analisada contém este jogador ainda.",
  "No deep reviews yet: crosshair, utility and positioning trends are unavailable.":
    "Ainda não há reviews profundas: as tendências de mira, utilitárias e posicionamento não estão disponíveis.",
  "Fewer than 5 analyzed matches: treat trends as early signals.":
    "Menos de 5 partidas analisadas: trate as tendências como sinais iniciais.",
  "No replay samples are stored for this match: crosshair placement, isolation and hold times are unavailable.":
    "Esta partida não tem amostras de replay salvas: posicionamento de mira, isolamento e tempo segurando posição não estão disponíveis.",
  "This match was processed before view pitch and height were recorded; reprocess it to measure crosshair placement.":
    "Esta partida foi processada antes de a inclinação e a altura da visão serem registradas; reprocesse para medir a posição da mira.",
  "Inventories at death are not in this demo's data, so unused utility is not measured.":
    "Os inventários na hora da morte não estão nos dados desta demo, então as utilitárias não usadas não são medidas.",
  "Molotov area-denial time is not derivable from the demo; landing callouts are the nearest callout seen in this match.":
    "O tempo de bloqueio do molotov não pode ser obtido da demo; o local de queda é o callout mais próximo visto nesta partida.",
  "No replay samples for this match: view angles are computed toward the enemy, and lineups and crosshair spots are unavailable.":
    "Esta partida não tem amostras de replay: a direção da visão é calculada em relação ao inimigo, e lineups e pontos de mira não estão disponíveis.",
  "Spots taken from replay samples are approximate: fine-tune lineups with the trajectory preview.":
    "Os pontos tirados das amostras de replay são aproximados: ajuste as lineups com a prévia da trajetória.",
  "Angles from replay samples are whole degrees taken a few times per second: fine-tune lineups with the trajectory preview.":
    "Os ângulos das amostras de replay são aproximados e registrados poucas vezes por segundo: ajuste as lineups com a prévia da trajetória.",
};
