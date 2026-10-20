// Français (fr) strings of the coach feature. Keys are the English source texts.
import { fr2 } from "./fr-2";

export const fr: Record<string, string> = {
  "{done} of {total} analyses on parser {v} · {pending} pending · {failed} failed":
    "{done} analyses sur {total} avec le parser {v} · {pending} en attente · {failed} en échec",
  "#{r} of {n}": "n° {r} sur {n}",
  "A player": "Un joueur",
  "Admins are never charged.": "Les admins ne sont jamais facturés.",
  "AI quality": "Qualité de l'IA",
  "Analyses on the current parser": "Analyses avec le parser actuel",
  "Analyze my new demos automatically":
    "Analyser mes nouvelles démos automatiquement",
  "Automatic reviews are off.": "Les analyses automatiques sont désactivées.",
  "Automatic reviews are on.": "Les analyses automatiques sont activées.",
  "Automatic reviews": "Analyses automatiques",
  "Average latency": "Latence moyenne",
  Average: "Moyenne",
  "Back to my review": "Retour à mon analyse",
  "Claims the match facts don't support are corrected or dropped. Uses the “Claim verifier” AI assignment.":
    "Les affirmations que les données du match ne confirment pas sont corrigées ou retirées. Utilise l'attribution IA « Vérificateur d'affirmations ».",
  Cost: "Coût",
  "Each automatic review uses credits. If you don't have enough, it is skipped and the match shows “Not enough credits”. Demos you're not in are never reviewed.":
    "Chaque analyse automatique utilise des crédits. S'il n'y en a pas assez, elle est ignorée et le match affiche « Crédits insuffisants ». Les démos où tu ne joues pas ne sont jamais analysées.",
  "Every player's role": "Le rôle de chaque joueur",
  "Grounded claims": "Affirmations fondées",
  "How players rate each prompt version, and the latest automated check of grounding, language and cost.":
    "Comment les joueurs notent chaque version du prompt, et la dernière vérification automatique des sources, de la langue et du coût.",
  "Key rounds": "Rounds clés",
  "Latest eval": "Dernière évaluation",
  "Match integrity": "Intégrité du match",
  Prompt: "Prompt",
  Purpose: "Usage",
  Rated: "Notés",
  Ratings: "Notes",
  "Rejected by the verifier": "Rejetées par le vérificateur",
  "Report in game via the scoreboard.":
    "Signale-le en jeu depuis le tableau des scores.",
  "Right language": "Bonne langue",
  "Round {n}: {title}": "Round {n} : {title}",
  Runs: "Exécutions",
  "Statistically unusual aim": "Visée statistiquement inhabituelle",
  "Statistically unusual player. This death doesn't count against you":
    "Joueur statistiquement inhabituel. Cette mort ne compte pas contre toi",
  "Team patterns": "Tendances de l'équipe",
  "Team plan for the next match": "Plan d'équipe pour le prochain match",
  "Team review cost": "Coût de l'analyse d'équipe",
  "Team scores vs the enemy team": "Notes de l'équipe face à l'équipe adverse",
  Teammate: "Coéquipier",
  "The team review could not be finished.":
    "L'analyse d'équipe n'a pas pu être terminée.",
  "This is a statistical signal, not proof. Deaths to these players aren't counted against you.":
    "C'est un signal statistique, pas une preuve. Les morts face à ces joueurs ne comptent pas contre toi.",
  "To fix": "À corriger",
  Variant: "Variante",
  "Verify every review's claims with a second AI pass":
    "Vérifier les affirmations de chaque analyse avec un second passage de l'IA",
  "What to do instead": "Que faire à la place",
  "When a demo of yours finishes processing, the AI Coach reviews it right away.":
    "Quand une de tes démos a fini d'être traitée, le coach IA l'analyse tout de suite.",
  "Whole team": "Toute l'équipe",
  "You {v} · lobby {m} · best {b}": "Toi {v} · lobby {m} · meilleur {b}",
  "You vs the lobby": "Toi face au lobby",
  "Your place among the {n} players of this match (1 = best).":
    "Ta place parmi les {n} joueurs de ce match (1 = meilleur).",
  "Your team, reviewed": "Ton équipe, analysée",
  "{k} very fast snaps landing exactly on the head (in {n} fights)":
    "{k} flicks très rapides pile dans la tête (sur {n} combats)",
  "Headshot rate far above the rest of the lobby ({n} kills)":
    "Taux de headshots bien au-dessus du reste du lobby ({n} kills)",
  "Unusually many head hits per shot ({n} shots)":
    "Énormément de touches à la tête par tir ({n} tirs)",
  "Hit back in {ms} ms on average after being shot ({n} times)":
    "Riposte en {ms} ms en moyenne après avoir été touché ({n} fois)",
  "{pct}% of kills through smoke or walls ({n} kills)":
    "{pct}% des kills à travers une smoke ou un mur ({n} kills)",
  "Statistically unusual play": "Jeu statistiquement inhabituel",
  "Account banned by VAC {d} days after this match":
    "Compte banni par VAC {d} jours après ce match",
  "Account received a game ban {d} days after this match":
    "Le compte a reçu un ban de jeu {d} jours après ce match",
  "Account banned by VAC after this match":
    "Compte banni par VAC après ce match",
  "Account received a game ban after this match":
    "Le compte a reçu un ban de jeu après ce match",
  Entry: "Entry",
  Support: "Support",
  Lurker: "Lurker",
  AWPer: "AWPer",
  Anchor: "Ancre",
  Flex: "Flex",
  Openings: "Ouvertures",
  "Converting advantages": "Conversion des avantages",
  "Run Team review": "Lancer l'analyse d'équipe",
  "Five players, one game plan": "Cinq joueurs, un plan de jeu",
  "Your whole team, reviewed like an IGL would":
    "Toute ton équipe, analysée comme le ferait un IGL",
  "Team scores: trading, utility, openings, economy, conversion":
    "Notes de l'équipe : trades, utilitaires, ouvertures, économie, conversion",
  "Each player's role with strengths and fixes":
    "Le rôle de chaque joueur avec ses points forts et ses corrections",
  "Key rounds with 2D clips": "Rounds clés avec clips 2D",
  "A team plan with who does what": "Un plan d'équipe avec qui fait quoi",
  New: "Nouveau",
  "Claim verifier": "Vérificateur d'affirmations",
  "Team review: the IGL view of a whole team. A strong model with a large context.":
    "Analyse d'équipe : la vision d'IGL d'une équipe entière. Un modèle puissant avec un grand contexte.",
  "Double-checks every claim of a review against the match facts. A fast, cheap model is enough.":
    "Vérifie chaque affirmation d'une analyse avec les données du match. Un modèle rapide et peu cher suffit.",
  "Credits per Team review (Pro pays one less).":
    "Crédits par analyse d'équipe (Pro paie un de moins).",
  "{traded} of {deaths} traded": "{traded} sur {deaths} tradées",
  "nearest teammate about {m} m away on average":
    "coéquipier le plus proche à environ {m} m en moyenne",
  "{n, plural, one {# death} other {# deaths}} in a crossfire":
    "{n, plural, one {# mort} other {# morts}} dans un crossfire",
  "{nade} into {place}": "{nade} vers {place}",
  "{nade} at {place}": "{nade} à {place}",
  "Round {round}: blinded {n, plural, one {# enemy} other {# enemies}} for {s} s.":
    "Round {round} : {n, plural, one {# ennemi aveuglé} other {# ennemis aveuglés}} pendant {s} s.",
  "Round {round}: {damage} damage.": "Round {round} : {damage} dégâts.",
  "The lobby threw it here {n, plural, one {once} other {# times}}; you died here {d, plural, one {once} other {# times}}.":
    "Le lobby l'a lancée ici {n, plural, one {une fois} other {# fois}} ; tu es mort ici {d, plural, one {une fois} other {# fois}}.",
  "Thrown from {place}.": "Lancée depuis {place}.",
  "Multi-kill": "Multi-kill",
  "You got two or more kills this round.":
    "Tu as fait deux kills ou plus dans ce round.",
  "Clutch won": "Clutch gagné",
  "You were the last one alive and won the round.":
    "Tu étais le dernier en vie et tu as gagné le round.",
  "You got the first kill of the round.":
    "Tu as fait le premier kill du round.",
  "First death": "Premier mort",
  "You were the first player to die this round.":
    "Tu as été le premier joueur à mourir dans ce round.",
  "Untraded death": "Mort sans trade",
  "No teammate killed your killer within 5 seconds.":
    "Aucun coéquipier n'a tué ton tueur dans les 5 secondes.",
  "Early death": "Mort rapide",
  "You died in the first 20 seconds of the round.":
    "Tu es mort dans les 20 premières secondes du round.",
  "You died without damaging an enemy.":
    "Tu es mort sans infliger de dégâts à un ennemi.",
  "Unused utility": "Utilitaires inutilisés",
  "You died with two or more grenades still in your inventory.":
    "Tu es mort avec deux grenades ou plus encore dans ton inventaire.",
  "Pistol round": "Round pistol",
  "Force buy": "Force buy",
  "Buy type": "Type d'achat",
  "Enemies blinded per flash": "Ennemis aveuglés par flash",
  "Team-flash rate": "Taux de flashs sur ton équipe",
  "{n, plural, one {# kill} other {# kills}}":
    "{n, plural, one {# kill} other {# kills}}",
  "opening duel": "duel d'ouverture",
  untraded: "sans trade",
  "at {place}": "à {place}",
  "Crosshair already on the enemy in {n} of {total} duels":
    "Viseur déjà sur l'ennemi dans {n} duels sur {total}",
  "{place}: crosshair off target in {n} of {total} duels":
    "{place} : viseur hors cible dans {n} duels sur {total}",
  "Where your crosshair was when each duel started":
    "Où était ton viseur au début de chaque duel",
  "Duel won": "Duel gagné",
  "Duel lost": "Duel perdu",
  "No winner": "Aucun gagnant",
  "Your crosshair tends to sit too high, above the head.":
    "Ton viseur a tendance à être trop haut, au-dessus de la tête.",
  "Lower it a touch: aim where heads appear, not over them.":
    "Baisse-le un peu : vise là où les têtes apparaissent, pas au-dessus.",
  "Your crosshair usually sits at head height.":
    "Ton viseur est en général à hauteur de tête.",
  "Good height. Keep it there while you move.":
    "Bonne hauteur. Garde-la pendant tes déplacements.",
  "Your crosshair tends to sit a little low: around neck height.":
    "Ton viseur a tendance à être un peu bas : à hauteur du cou.",
  "Raise it slightly so the first bullet goes to the head.":
    "Remonte-le légèrement pour que la première balle aille à la tête.",
  "Your crosshair tends to sit low: around chest height.":
    "Ton viseur a tendance à être bas : à hauteur du torse.",
  "Raise it to head height before you peek.":
    "Remonte-le à hauteur de tête avant de peek.",
  "Your crosshair tends to sit very low: around stomach height.":
    "Ton viseur a tendance à être très bas : à hauteur du ventre.",
  "Raise it to head height before you peek; check it every time you stop.":
    "Remonte-le à hauteur de tête avant de peek ; vérifie-le à chaque arrêt.",
  "Your crosshair tends to sit very low: around the legs.":
    "Ton viseur a tendance à être très bas : au niveau des jambes.",
  "It also tends to be to the left of where enemies appear: check the other side of the angle first.":
    "Il a aussi tendance à être à gauche de l'endroit où apparaissent les ennemis : vérifie d'abord l'autre côté de l'angle.",
  "It also tends to be to the right of where enemies appear: check the other side of the angle first.":
    "Il a aussi tendance à être à droite de l'endroit où apparaissent les ennemis : vérifie d'abord l'autre côté de l'angle.",
  "On target": "Sur la cible",
  "Your crosshair was already on the enemy.":
    "Ton viseur était déjà sur l'ennemi.",
  Near: "Proche",
  "One small adjustment away.": "À un petit ajustement près.",
  "Big flick": "Gros flick",
  "You needed a big flick.": "Il t'a fallu un gros flick.",
  "Duels with the crosshair already on the enemy":
    "Duels avec le viseur déjà sur l'ennemi",
  "Crosshair already on the enemy": "Viseur déjà sur l'ennemi",
  Strength: "Point fort",
  "To improve": "À améliorer",
  "Your AI coach": "Ton coach IA",
  "Pick a match and a player. The coach reviews every round and shows you the moments that matter in 2D replay.":
    "Choisis un match et un joueur. Le coach analyse chaque round et te montre les moments importants en replay 2D.",
  "Choose a match": "Choisis un match",
  "No analyzed matches yet": "Aucun match analysé pour l'instant",
  "Upload a demo and come back: the coach needs a match to review.":
    "Importe une démo et reviens : le coach a besoin d'un match à analyser.",
  Change: "Changer",
  "Change match": "Changer de match",
  "Choose the player": "Choisis le joueur",
  "Who should the coach review?": "Qui le coach doit-il analyser ?",
  "Started as CT": "A commencé CT",
  "Started as T": "A commencé T",
  Match: "Match",
  Review: "Analyse",
  Steps: "Étapes",
  Reviewed: "Analysé",
  "Choose the player to review": "Choisis le joueur à analyser",
  "The coach is offline right now": "Le coach est hors ligne pour le moment",
  "The review could not be finished.": "L'analyse n'a pas pu être terminée.",
  "Please try again later.": "Réessaie plus tard.",
  "Reading {n} events…": "Lecture de {n} événements…",
  "Tracking your crosshair…": "Suivi de ton viseur…",
  "Mapping every duel you took…": "Repérage de chaque duel que tu as pris…",
  "Checking who traded whom…": "Vérification de qui a tradé qui…",
  "Counting your utility…": "Comptage de tes utilitaires…",
  "Calling the IGL…": "Appel de l'IGL…",
  "Comparing you with the lobby…": "Comparaison avec le lobby…",
  "Checking every claim against the demo…":
    "Vérification de chaque affirmation avec la démo…",
  "Writing your plan for the next match…":
    "Rédaction de ton plan pour le prochain match…",
  "{coach} is reviewing {name}": "{coach} analyse {name}",
  "A real review takes 10 to 60 seconds. Keep this tab open.":
    "Une vraie analyse prend 10 à 60 secondes. Garde cet onglet ouvert.",
  "Your match, reviewed": "Ton match, analysé",
  "Saved review from {date}": "Analyse enregistrée du {date}",
  "Overall score {n} of 100": "Note globale {n} sur 100",
  Overall: "Global",
  "Your scores vs the lobby": "Tes notes face au lobby",
  "Lobby average": "Moyenne du lobby",
  "Key moments": "Moments clés",
  Priorities: "Priorités",
  "The coach found nothing it could back with evidence for this player.":
    "Le coach n'a rien trouvé qu'il puisse appuyer par des preuves pour ce joueur.",
  Drills: "Exercices",
  "Ask again": "Redemander",
  "Open match analysis": "Ouvrir l'analyse du match",
  "Watch clip": "Voir le clip",
  Highlight: "Temps fort",
  Mistake: "Erreur",
  Instead: "À la place",
  "About {n} minutes in total": "Environ {n} minutes au total",
  "{done} of {n} done": "{done} sur {n} faits",
  "{n} min": "{n} min",
  Goal: "Objectif",
  "Get {name}'s full review": "Obtiens l'analyse complète de {name}",
  "Scores against the lobby, key moments as 2D replays, drills and a plan for your next match.":
    "Notes face au lobby, moments clés en replay 2D, exercices et un plan pour ton prochain match.",
  "Open in the coach": "Ouvrir dans le coach",
  Players: "Joueurs",
  "Evidence: rounds {rounds}": "Preuves : rounds {rounds}",
  "Evidence: {n} metric(s)": "Preuves : {n} indicateur(s)",
  "Keep doing": "À garder",
  "Limits of this review": "Limites de cette analyse",
  Practice: "Entraînement",
  ...fr2,
};
