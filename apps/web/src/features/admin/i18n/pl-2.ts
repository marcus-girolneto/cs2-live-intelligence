// Polski (pl) strings of the admin feature, part 2.
export const pl2: Record<string, string> = {
  "Discounted Deep review": "Tańsza analiza Deep",
  "{purpose} saved. New requests use it immediately.":
    "Zapisano {purpose}. Nowe zapytania używają tego od razu.",
  "Each purpose runs on its own model. Unassigned purposes fall back: Deep review and Monthly report use Quick review, Personal Coach uses Deep review, then the .env defaults.":
    "Każde zastosowanie działa na własnym modelu. Nieprzypisane zastosowania korzystają z zapasowego: analiza Deep i raport miesięczny używają analizy Quick, Personal Coach używa analizy Deep, a potem wartości z .env.",
  "Search {n} models": "Szukaj wśród {n} modeli",
  "Reload the model list": "Odśwież listę modeli",
  "Loading this provider's models…": "Wczytywanie modeli tego dostawcy…",
  "This provider doesn't list “{model}”. Pick one from the list.":
    "Ten dostawca nie wymienia „{model}”. Wybierz model z listy.",
  "Type the model id manually.": "Wpisz id modelu ręcznie.",
  "This provider has no model list. Type the model id manually.":
    "Ten dostawca nie ma listy modeli. Wpisz id modelu ręcznie.",
  "≈ {cost} per call at list price": "≈ {cost} za wywołanie według cennika",
  "Price not published by this provider.": "Dostawca nie publikuje ceny.",
  "Answered in {ms} ms": "Odpowiedź w {ms} ms",
  "Saved: {model} · {date}": "Zapisano: {model} · {date}",
  "Not assigned": "Nieprzypisany",
  "Save {purpose}": "Zapisz {purpose}",
  "Same as Quick review": "Jak analiza Quick",
  "Same as Deep review": "Jak analiza Deep",
  Assigned: "Przypisany",
  "Uses {purpose}": "Używa {purpose}",
  "Falls back to .env": "Korzysta z .env",
  "Not configured": "Nieskonfigurowany",
  "Personal Coach plans from all of a player's matches (Pro). Your strongest long-context model.":
    "Plany Personal Coach na podstawie wszystkich meczów gracza (Pro). Twój najmocniejszy model z długim kontekstem.",
  "We prefilled Extra body with provider.data_collection = \"deny\": OpenRouter then only routes to upstream providers that don't store or train on your prompts (players' match data). Remove it only if you accept that.":
    'Wstępnie uzupełniliśmy dodatkowe body o provider.data_collection = "deny": OpenRouter kieruje wtedy zapytania tylko do dostawców, którzy nie przechowują twoich promptów ani nie trenują na nich (danych meczów graczy). Usuń to tylko, jeśli to akceptujesz.',
  "{n}k context": "kontekst {n}k",
  "no structured outputs": "brak ustrukturyzowanych odpowiedzi",
  Integrations: "Integracje",
  "Changes apply immediately and are stored encrypted in the database. No restart needed.":
    "Zmiany działają od razu i są zapisywane zaszyfrowane w bazie danych. Restart nie jest potrzebny.",
  "Configured · Database": "Skonfigurowano · Baza danych",
  "From .env (read-only bootstrap)":
    "Z .env (początkowa konfiguracja tylko do odczytu)",
  "Testing…": "Testowanie…",
  Connected: "Połączono",
  "{ms} ms": "{ms} ms",
  "Live mode": "Tryb produkcyjny",
  "Test mode": "Tryb testowy",
  "The test failed.": "Test nie powiódł się.",
  "Steam Web API": "Steam Web API",
  "Profiles, avatars and the account checks behind welcome credits.":
    "Profile, awatary i sprawdzanie kont przy kredytach powitalnych.",
  "Create a key on the Steam developer page (signed in with the account that owns this site):":
    "Utwórz klucz na stronie deweloperów Steam (zalogowany na konto właściciela tej strony):",
  "Web API key": "Klucz Web API",
  "Remove the stored Steam key?": "Usunąć zapisany klucz Steam?",
  Stripe: "Stripe",
  "Plan subscriptions and credit pack checkout.":
    "Subskrypcje planów i zakup pakietów kredytów.",
  "Keys: Stripe Dashboard → Developers → API keys. Webhook: Developers → Webhooks → Add endpoint, then copy its signing secret.":
    "Klucze: Stripe Dashboard → Developers → API keys. Webhook: Developers → Webhooks → Add endpoint, a potem skopiuj jego signing secret.",
  "Webhook URL": "URL webhooka",
  "Secret key": "Klucz tajny",
  "Remove the stored Stripe secret key?": "Usunąć zapisany tajny klucz Stripe?",
  "Webhook signing secret": "Sekret podpisu webhooka",
  "Remove the stored webhook secret?": "Usunąć zapisany sekret webhooka?",
  "Publishable key (public)": "Klucz publiczny",
  "Accept payments": "Przyjmuj płatności",
  "When off, checkout buttons show “Coming soon”.":
    "Gdy wyłączone, przyciski płatności pokazują „Wkrótce”.",
  "Add the secret key first.": "Najpierw dodaj klucz tajny.",
  "Add key": "Dodaj klucz",
  "Save key": "Zapisz klucz",
  Copy: "Kopiuj",
  Copied: "Skopiowano",
  Save: "Zapisz",
  "Enter a value.": "Wpisz wartość.",
  "Keys never contain spaces.": "Klucze nigdy nie zawierają spacji.",
  "A Steam Web API key is 32 hexadecimal characters.":
    "Klucz Steam Web API ma 32 znaki szesnastkowe.",
  "Stripe secret keys start with sk_live_, sk_test_ (or rk_ for restricted keys).":
    "Tajne klucze Stripe zaczynają się od sk_live_, sk_test_ (lub rk_ dla kluczy ograniczonych).",
  "Stripe webhook secrets start with whsec_.":
    "Sekrety webhooków Stripe zaczynają się od whsec_.",
  "Publishable keys start with pk_live_ or pk_test_.":
    "Klucze publiczne zaczynają się od pk_live_ lub pk_test_.",
  "Steam key saved.": "Klucz Steam zapisany.",
  "Steam key removed.": "Klucz Steam usunięty.",
  "Stripe secret key saved.": "Tajny klucz Stripe zapisany.",
  "Stripe secret key removed.": "Tajny klucz Stripe usunięty.",
  "Webhook secret saved.": "Sekret webhooka zapisany.",
  "Webhook secret removed.": "Sekret webhooka usunięty.",
  "Publishable key saved.": "Klucz publiczny zapisany.",
  "Payments enabled.": "Płatności włączone.",
  "Payments disabled.": "Płatności wyłączone.",
  Product: "Produkt",
  "Time zone for daily limits and monthly reports, Personal Coach cadence and upload size.":
    "Strefa czasowa dla limitów dziennych i raportów miesięcznych, częstotliwość Personal Coach i rozmiar przesyłania.",
  "Time zone": "Strefa czasowa",
  "Days and months start at midnight in this zone.":
    "Dni i miesiące zaczynają się o północy w tej strefie.",
  "Not available on this server yet.": "Jeszcze niedostępne na tym serwerze.",
  "Personal Coach: days between new plans":
    "Personal Coach: dni między nowymi planami",
  "Personal Coach: new matches for a rewrite":
    "Personal Coach: nowe mecze do przepisania planu",
  "Demo upload limit (MB)": "Limit przesyłania dema (MB)",
  "A player can ask for a new plan after this many days.":
    "Gracz może poprosić o nowy plan po tylu dniach.",
  "…or sooner after this many new matches (also the automatic rewrite).":
    "…albo wcześniej po tylu nowych meczach (to też próg automatycznego przepisania).",
  "Default 500 MB. The web proxy streams uploads up to this size.":
    "Domyślnie 500 MB. Proxy przesyła pliki do tego rozmiaru.",
  "Between 1 and 90 days.": "Od 1 do 90 dni.",
  "Between 1 and 50 matches.": "Od 1 do 50 meczów.",
  "Between 1 and 1024 MB.": "Od 1 do 1024 MB.",
};
