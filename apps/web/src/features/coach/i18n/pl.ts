// Polski (pl) strings of the coach feature. Keys are the English source texts.
import { pl2 } from "./pl-2";

export const pl: Record<string, string> = {
  "{done} of {total} analyses on parser {v} · {pending} pending · {failed} failed":
    "{done} z {total} analiz na parserze {v} · oczekujące: {pending} · błędy: {failed}",
  "#{r} of {n}": "#{r} z {n}",
  "A player": "Gracz",
  "Admins are never charged.": "Administratorzy nigdy nie płacą.",
  "AI quality": "Jakość AI",
  "Analyses on the current parser": "Analizy na obecnym parserze",
  "Analyze my new demos automatically": "Analizuj moje nowe dema automatycznie",
  "Automatic reviews are off.": "Automatyczne analizy są wyłączone.",
  "Automatic reviews are on.": "Automatyczne analizy są włączone.",
  "Automatic reviews": "Automatyczne analizy",
  "Average latency": "Średnie opóźnienie",
  Average: "Średnia",
  "Back to my review": "Wróć do mojej analizy",
  "Claims the match facts don't support are corrected or dropped. Uses the “Claim verifier” AI assignment.":
    "Stwierdzenia, których nie potwierdzają dane meczu, są poprawiane lub usuwane. Używa przypisania AI „Weryfikator stwierdzeń”.",
  Cost: "Koszt",
  "Each automatic review uses credits. If you don't have enough, it is skipped and the match shows “Not enough credits”. Demos you're not in are never reviewed.":
    "Każda automatyczna analiza zużywa kredyty. Jeśli ich brakuje, jest pomijana, a mecz pokazuje „Za mało kredytów”. Dema, w których nie grasz, nigdy nie są analizowane.",
  "Every player's role": "Rola każdego gracza",
  "Grounded claims": "Poparte stwierdzenia",
  "How players rate each prompt version, and the latest automated check of grounding, language and cost.":
    "Jak gracze oceniają każdą wersję promptu i ostatnia automatyczna kontrola podstaw, języka i kosztu.",
  "Key rounds": "Kluczowe rundy",
  "Latest eval": "Ostatnia ocena",
  "Match integrity": "Uczciwość meczu",
  Prompt: "Prompt",
  Purpose: "Zastosowanie",
  Rated: "Ocenione",
  Ratings: "Oceny",
  "Rejected by the verifier": "Odrzucone przez weryfikator",
  "Report in game via the scoreboard.": "Zgłoś w grze przez tablicę wyników.",
  "Right language": "Właściwy język",
  "Round {n}: {title}": "Runda {n}: {title}",
  Runs: "Uruchomienia",
  "Statistically unusual aim": "Statystycznie nietypowy aim",
  "Statistically unusual player. This death doesn't count against you":
    "Statystycznie nietypowy gracz. Ten zgon nie liczy się na twoją niekorzyść",
  "Team patterns": "Wzorce drużyny",
  "Team plan for the next match": "Plan drużyny na następny mecz",
  "Team review cost": "Koszt analizy drużyny",
  "Team scores vs the enemy team": "Oceny drużyny na tle przeciwnika",
  Teammate: "Kolega z drużyny",
  "The team review could not be finished.":
    "Nie udało się dokończyć analizy drużyny.",
  "This is a statistical signal, not proof. Deaths to these players aren't counted against you.":
    "To sygnał statystyczny, a nie dowód. Zgony z rąk tych graczy nie liczą się na twoją niekorzyść.",
  "To fix": "Do poprawy",
  Variant: "Wariant",
  "Verify every review's claims with a second AI pass":
    "Weryfikuj stwierdzenia każdej analizy drugim przejściem AI",
  "What to do instead": "Co zrobić zamiast tego",
  "When a demo of yours finishes processing, the AI Coach reviews it right away.":
    "Gdy twoje demo skończy się przetwarzać, trener AI od razu je analizuje.",
  "Whole team": "Cała drużyna",
  "You {v} · lobby {m} · best {b}": "Ty {v} · lobby {m} · najlepszy {b}",
  "You vs the lobby": "Ty na tle lobby",
  "Your place among the {n} players of this match (1 = best).":
    "Twoje miejsce wśród {n} graczy tego meczu (1 = najlepszy).",
  "Your team, reviewed": "Analiza twojej drużyny",
  "{k} very fast snaps landing exactly on the head (in {n} fights)":
    "{k} bardzo szybkich flicków prosto w głowę (w {n} walkach)",
  "Headshot rate far above the rest of the lobby ({n} kills)":
    "Odsetek headshotów daleko powyżej reszty lobby ({n} killi)",
  "Unusually many head hits per shot ({n} shots)":
    "Nietypowo dużo trafień w głowę na strzał ({n} strzałów)",
  "Hit back in {ms} ms on average after being shot ({n} times)":
    "Odpowiada ogniem średnio po {ms} ms od trafienia ({n} razy)",
  "{pct}% of kills through smoke or walls ({n} kills)":
    "{pct}% killi przez smoke'a lub ściany ({n} killi)",
  "Statistically unusual play": "Statystycznie nietypowa gra",
  "Account banned by VAC {d} days after this match":
    "Konto zbanowane przez VAC {d} dni po tym meczu",
  "Account received a game ban {d} days after this match":
    "Konto dostało bana w grze {d} dni po tym meczu",
  "Account banned by VAC after this match":
    "Konto zbanowane przez VAC po tym meczu",
  "Account received a game ban after this match":
    "Konto dostało bana w grze po tym meczu",
  Entry: "Entry",
  Support: "Support",
  Lurker: "Lurker",
  AWPer: "AWPer",
  Anchor: "Kotwica",
  Flex: "Flex",
  Openings: "Otwarcia",
  "Converting advantages": "Zamienianie przewagi w rundy",
  "Run Team review": "Uruchom analizę drużyny",
  "Five players, one game plan": "Pięciu graczy, jeden plan gry",
  "Your whole team, reviewed like an IGL would":
    "Cała twoja drużyna przeanalizowana tak, jak zrobiłby to IGL",
  "Team scores: trading, utility, openings, economy, conversion":
    "Oceny drużyny: trade'y, granaty, otwarcia, ekonomia, zamienianie przewagi",
  "Each player's role with strengths and fixes":
    "Rola każdego gracza z mocnymi stronami i poprawkami",
  "Key rounds with 2D clips": "Kluczowe rundy z klipami 2D",
  "A team plan with who does what": "Plan drużyny: kto co robi",
  New: "Nowość",
  "Claim verifier": "Weryfikator stwierdzeń",
  "Team review: the IGL view of a whole team. A strong model with a large context.":
    "Analiza drużyny: spojrzenie IGL-a na całą drużynę. Mocny model z dużym kontekstem.",
  "Double-checks every claim of a review against the match facts. A fast, cheap model is enough.":
    "Sprawdza każde stwierdzenie analizy z danymi meczu. Wystarczy szybki, tani model.",
  "Credits per Team review (Pro pays one less).":
    "Kredyty za analizę drużyny (Pro płaci o jeden mniej).",
  "{traded} of {deaths} traded": "trade przy {traded} z {deaths}",
  "nearest teammate about {m} m away on average":
    "najbliższy kolega średnio ok. {m} m dalej",
  "{n, plural, one {# death} other {# deaths}} in a crossfire":
    "{n, plural, one {# zgon} few {# zgony} many {# zgonów} other {# zgonu}} w krzyżowym ogniu",
  "{nade} into {place}": "{nade} na {place}",
  "{nade} at {place}": "{nade} na {place}",
  "Round {round}: blinded {n, plural, one {# enemy} other {# enemies}} for {s} s.":
    "Runda {round}: oślepił {n, plural, one {# przeciwnika} few {# przeciwników} many {# przeciwników} other {# przeciwnika}} na {s} s.",
  "Round {round}: {damage} damage.": "Runda {round}: {damage} obrażeń.",
  "The lobby threw it here {n, plural, one {once} other {# times}}; you died here {d, plural, one {once} other {# times}}.":
    "Lobby rzucało tu {n, plural, one {raz} other {# razy}}; ty zginąłeś tu {d, plural, one {raz} other {# razy}}.",
  "Thrown from {place}.": "Rzucony z {place}.",
  "Multi-kill": "Multikill",
  "You got two or more kills this round.":
    "Masz dwa lub więcej killi w tej rundzie.",
  "Clutch won": "Wygrany clutch",
  "You were the last one alive and won the round.":
    "Byłeś ostatni przy życiu i wygrałeś rundę.",
  "You got the first kill of the round.":
    "Zdobyłeś pierwszego killa w rundzie.",
  "First death": "Pierwszy zgon",
  "You were the first player to die this round.":
    "Zginąłeś jako pierwszy w tej rundzie.",
  "Untraded death": "Zgon bez trade'u",
  "No teammate killed your killer within 5 seconds.":
    "Żaden kolega nie zabił twojego zabójcy w ciągu 5 sekund.",
  "Early death": "Wczesny zgon",
  "You died in the first 20 seconds of the round.":
    "Zginąłeś w pierwszych 20 sekundach rundy.",
  "You died without damaging an enemy.":
    "Zginąłeś, nie zadając obrażeń żadnemu przeciwnikowi.",
  "Unused utility": "Niewykorzystane granaty",
  "You died with two or more grenades still in your inventory.":
    "Zginąłeś z dwoma lub więcej granatami w ekwipunku.",
  "Pistol round": "Runda pistoletowa",
  "Force buy": "Force buy",
  "Buy type": "Rodzaj zakupu",
  "Enemies blinded per flash": "Oślepieni przeciwnicy na flash",
  "Team-flash rate": "Odsetek flashy we własną drużynę",
  "{n, plural, one {# kill} other {# kills}}":
    "{n, plural, one {# kill} few {# kille} many {# killi} other {# killa}}",
  "opening duel": "pojedynek otwierający",
  untraded: "bez trade'u",
  "at {place}": "na {place}",
  "Crosshair already on the enemy in {n} of {total} duels":
    "Celownik już na przeciwniku w {n} z {total} pojedynków",
  "{place}: crosshair off target in {n} of {total} duels":
    "{place}: celownik obok celu w {n} z {total} pojedynków",
  "Where your crosshair was when each duel started":
    "Gdzie był twój celownik na początku każdego pojedynku",
  "Duel won": "Pojedynek wygrany",
  "Duel lost": "Pojedynek przegrany",
  "No winner": "Bez zwycięzcy",
  "Your crosshair tends to sit too high, above the head.":
    "Twój celownik zwykle jest za wysoko, nad głową.",
  "Lower it a touch: aim where heads appear, not over them.":
    "Opuść go trochę: celuj tam, gdzie pojawiają się głowy, a nie nad nimi.",
  "Your crosshair usually sits at head height.":
    "Twój celownik zwykle jest na wysokości głowy.",
  "Good height. Keep it there while you move.":
    "Dobra wysokość. Trzymaj ją też w ruchu.",
  "Your crosshair tends to sit a little low: around neck height.":
    "Twój celownik zwykle jest trochę za nisko: na wysokości szyi.",
  "Raise it slightly so the first bullet goes to the head.":
    "Podnieś go lekko, żeby pierwsza kula poszła w głowę.",
  "Your crosshair tends to sit low: around chest height.":
    "Twój celownik zwykle jest nisko: na wysokości klatki piersiowej.",
  "Raise it to head height before you peek.":
    "Podnieś go na wysokość głowy, zanim wyjrzysz.",
  "Your crosshair tends to sit very low: around stomach height.":
    "Twój celownik zwykle jest bardzo nisko: na wysokości brzucha.",
  "Raise it to head height before you peek; check it every time you stop.":
    "Podnieś go na wysokość głowy, zanim wyjrzysz; sprawdzaj go przy każdym zatrzymaniu.",
  "Your crosshair tends to sit very low: around the legs.":
    "Twój celownik zwykle jest bardzo nisko: na wysokości nóg.",
  "It also tends to be to the left of where enemies appear: check the other side of the angle first.":
    "Często jest też na lewo od miejsca, gdzie pojawiają się przeciwnicy: najpierw sprawdzaj drugą stronę kąta.",
  "It also tends to be to the right of where enemies appear: check the other side of the angle first.":
    "Często jest też na prawo od miejsca, gdzie pojawiają się przeciwnicy: najpierw sprawdzaj drugą stronę kąta.",
  "On target": "W celu",
  "Your crosshair was already on the enemy.":
    "Twój celownik był już na przeciwniku.",
  Near: "Blisko",
  "One small adjustment away.": "Wystarczyła mała korekta.",
  "Big flick": "Duży flick",
  "You needed a big flick.": "Potrzebowałeś dużego flicka.",
  "Duels with the crosshair already on the enemy":
    "Pojedynki z celownikiem już na przeciwniku",
  "Crosshair already on the enemy": "Celownik już na przeciwniku",
  Strength: "Mocna strona",
  "To improve": "Do poprawy",
  "Your AI coach": "Twój trener AI",
  "Pick a match and a player. The coach reviews every round and shows you the moments that matter in 2D replay.":
    "Wybierz mecz i gracza. Trener przeanalizuje każdą rundę i pokaże ważne momenty w powtórce 2D.",
  "Choose a match": "Wybierz mecz",
  "No analyzed matches yet": "Brak przeanalizowanych meczów",
  "Upload a demo and come back: the coach needs a match to review.":
    "Prześlij demo i wróć: trener potrzebuje meczu do analizy.",
  Change: "Zmień",
  "Change match": "Zmień mecz",
  "Choose the player": "Wybierz gracza",
  "Who should the coach review?": "Kogo ma przeanalizować trener?",
  "Started as CT": "Zaczął jako CT",
  "Started as T": "Zaczął jako T",
  Match: "Mecz",
  Review: "Analiza",
  Steps: "Kroki",
  Reviewed: "Przeanalizowano",
  "Choose the player to review": "Wybierz gracza do analizy",
  "The coach is offline right now": "Trener jest teraz offline",
  "The review could not be finished.": "Nie udało się dokończyć analizy.",
  "Please try again later.": "Spróbuj ponownie później.",
  "Reading {n} events…": "Czytam {n} zdarzeń…",
  "Tracking your crosshair…": "Śledzę twój celownik…",
  "Mapping every duel you took…": "Zaznaczam każdy twój pojedynek…",
  "Checking who traded whom…": "Sprawdzam, kto kogo trade'ował…",
  "Counting your utility…": "Liczę twoje granaty…",
  "Calling the IGL…": "Wołam IGL-a…",
  "Comparing you with the lobby…": "Porównuję cię z lobby…",
  "Checking every claim against the demo…":
    "Sprawdzam każde stwierdzenie z demem…",
  "Writing your plan for the next match…": "Piszę twój plan na następny mecz…",
  "{coach} is reviewing {name}": "{coach} analizuje grę {name}",
  "A real review takes 10 to 60 seconds. Keep this tab open.":
    "Prawdziwa analiza trwa od 10 do 60 sekund. Nie zamykaj tej karty.",
  "Your match, reviewed": "Twój mecz po analizie",
  "Saved review from {date}": "Zapisana analiza z {date}",
  "Overall score {n} of 100": "Ocena ogólna {n} na 100",
  Overall: "Ogólnie",
  "Your scores vs the lobby": "Twoje oceny na tle lobby",
  "Lobby average": "Średnia lobby",
  "Key moments": "Kluczowe momenty",
  Priorities: "Priorytety",
  "The coach found nothing it could back with evidence for this player.":
    "Trener nie znalazł niczego, co mógłby poprzeć danymi dla tego gracza.",
  Drills: "Ćwiczenia",
  "Ask again": "Zapytaj ponownie",
  "Open match analysis": "Otwórz analizę meczu",
  "Watch clip": "Zobacz klip",
  Highlight: "Najlepsza akcja",
  Mistake: "Błąd",
  Instead: "Zamiast tego",
  "About {n} minutes in total": "Łącznie około {n} minut",
  "{done} of {n} done": "Zrobiono {done} z {n}",
  "{n} min": "{n} min",
  Goal: "Cel",
  "Get {name}'s full review": "Zdobądź pełną analizę gracza {name}",
  "Scores against the lobby, key moments as 2D replays, drills and a plan for your next match.":
    "Oceny na tle lobby, kluczowe momenty w powtórkach 2D, ćwiczenia i plan na następny mecz.",
  "Open in the coach": "Otwórz u trenera",
  Players: "Gracze",
  "Evidence: rounds {rounds}": "Dowody: rundy {rounds}",
  "Evidence: {n} metric(s)": "Dowody: statystyki ({n})",
  "Keep doing": "Rób tak dalej",
  "Limits of this review": "Ograniczenia tej analizy",
  Practice: "Trening",
  "Review for {name}": "Analiza dla {name}",
  "Plan for your next match": "Plan na następny mecz",
  "Saved to your progress.": "Zapisano w twoich postępach.",
  ...pl2,
};
