// Deutsch (de) strings of the admin feature, part 2.
export const de2: Record<string, string> = {
  "Most AI reviews one account can run per day, whatever its balance.":
    "Höchstzahl an KI-Analysen pro Konto und Tag, unabhängig vom Guthaben.",
  "Discounted Deep review": "Vergünstigte Deep-Analyse",
  "{purpose} saved. New requests use it immediately.":
    "{purpose} gespeichert. Neue Anfragen nutzen es sofort.",
  "Each purpose runs on its own model. Unassigned purposes fall back: Deep review and Monthly report use Quick review, Personal Coach uses Deep review, then the .env defaults.":
    "Jeder Zweck läuft auf einem eigenen Modell. Nicht zugewiesene Zwecke greifen zurück: Deep-Analyse und Monatsbericht nutzen die Quick-Analyse, Personal Coach nutzt die Deep-Analyse, danach die .env-Standardwerte.",
  "Search {n} models": "{n} Modelle durchsuchen",
  "Reload the model list": "Modellliste neu laden",
  "Loading this provider's models…": "Modelle dieses Anbieters werden geladen…",
  "This provider doesn't list “{model}”. Pick one from the list.":
    "Dieser Anbieter listet „{model}“ nicht. Wähle eines aus der Liste.",
  "Type the model id manually.": "Gib die Modell-ID manuell ein.",
  "This provider has no model list. Type the model id manually.":
    "Dieser Anbieter hat keine Modellliste. Gib die Modell-ID manuell ein.",
  "≈ {cost} per call at list price": "≈ {cost} pro Aufruf zum Listenpreis",
  "Price not published by this provider.":
    "Der Anbieter veröffentlicht keinen Preis.",
  "Answered in {ms} ms": "Antwort in {ms} ms",
  "Saved: {model} · {date}": "Gespeichert: {model} · {date}",
  "Not assigned": "Nicht zugewiesen",
  "Save {purpose}": "{purpose} speichern",
  "Same as Quick review": "Wie Quick-Analyse",
  "Same as Deep review": "Wie Deep-Analyse",
  Assigned: "Zugewiesen",
  "Uses {purpose}": "Nutzt {purpose}",
  "Falls back to .env": "Greift auf .env zurück",
  "Not configured": "Nicht konfiguriert",
  "Personal Coach plans from all of a player's matches (Pro). Your strongest long-context model.":
    "Personal-Coach-Pläne aus allen Matches eines Spielers (Pro). Dein stärkstes Modell mit langem Kontext.",
  "We prefilled Extra body with provider.data_collection = \"deny\": OpenRouter then only routes to upstream providers that don't store or train on your prompts (players' match data). Remove it only if you accept that.":
    'Wir haben den zusätzlichen Body mit provider.data_collection = "deny" vorausgefüllt: OpenRouter leitet dann nur an Anbieter weiter, die deine Prompts (Matchdaten der Spieler) weder speichern noch damit trainieren. Entferne das nur, wenn du das akzeptierst.',
  "{n}k context": "{n}k Kontext",
  "no structured outputs": "keine strukturierten Ausgaben",
  Integrations: "Integrationen",
  "Changes apply immediately and are stored encrypted in the database. No restart needed.":
    "Änderungen gelten sofort und werden verschlüsselt in der Datenbank gespeichert. Kein Neustart nötig.",
  "Configured · Database": "Konfiguriert · Datenbank",
  "From .env (read-only bootstrap)": "Aus .env (schreibgeschützter Start)",
  "Testing…": "Wird getestet…",
  Connected: "Verbunden",
  "{ms} ms": "{ms} ms",
  "Live mode": "Live-Modus",
  "Test mode": "Testmodus",
  "The test failed.": "Der Test ist fehlgeschlagen.",
  "Steam Web API": "Steam Web API",
  "Profiles, avatars and the account checks behind welcome credits.":
    "Profile, Avatare und die Kontoprüfungen hinter den Willkommens-Credits.",
  "Create a key on the Steam developer page (signed in with the account that owns this site):":
    "Erstelle einen Schlüssel auf der Steam-Entwicklerseite (angemeldet mit dem Konto, dem diese Seite gehört):",
  "Web API key": "Web-API-Schlüssel",
  "Remove the stored Steam key?": "Gespeicherten Steam-Schlüssel entfernen?",
  Stripe: "Stripe",
  "Plan subscriptions and credit pack checkout.":
    "Plan-Abos und Kauf von Credit-Paketen.",
  "Keys: Stripe Dashboard → Developers → API keys. Webhook: Developers → Webhooks → Add endpoint, then copy its signing secret.":
    "Schlüssel: Stripe Dashboard → Developers → API keys. Webhook: Developers → Webhooks → Add endpoint, dann sein Signing Secret kopieren.",
  "Webhook URL": "Webhook-URL",
  "Secret key": "Geheimer Schlüssel",
  "Remove the stored Stripe secret key?":
    "Gespeicherten geheimen Stripe-Schlüssel entfernen?",
  "Webhook signing secret": "Webhook-Signing-Secret",
  "Remove the stored webhook secret?":
    "Gespeichertes Webhook-Secret entfernen?",
  "Publishable key (public)": "Öffentlicher Schlüssel",
  "Accept payments": "Zahlungen annehmen",
  "When off, checkout buttons show “Coming soon”.":
    "Wenn aus, zeigen die Kauf-Buttons „Bald verfügbar“.",
  "Add the secret key first.": "Füge zuerst den geheimen Schlüssel hinzu.",
  "Add key": "Schlüssel hinzufügen",
  "Save key": "Schlüssel speichern",
  Copy: "Kopieren",
  Copied: "Kopiert",
  Save: "Speichern",
  "Enter a value.": "Gib einen Wert ein.",
  "Keys never contain spaces.": "Schlüssel enthalten nie Leerzeichen.",
  "A Steam Web API key is 32 hexadecimal characters.":
    "Ein Steam-Web-API-Schlüssel hat 32 Hexadezimalzeichen.",
  "Stripe secret keys start with sk_live_, sk_test_ (or rk_ for restricted keys).":
    "Geheime Stripe-Schlüssel beginnen mit sk_live_, sk_test_ (oder rk_ für eingeschränkte Schlüssel).",
  "Stripe webhook secrets start with whsec_.":
    "Stripe-Webhook-Secrets beginnen mit whsec_.",
  "Publishable keys start with pk_live_ or pk_test_.":
    "Öffentliche Schlüssel beginnen mit pk_live_ oder pk_test_.",
  "Steam key saved.": "Steam-Schlüssel gespeichert.",
  "Steam key removed.": "Steam-Schlüssel entfernt.",
  "Stripe secret key saved.": "Geheimer Stripe-Schlüssel gespeichert.",
  "Stripe secret key removed.": "Geheimer Stripe-Schlüssel entfernt.",
  "Webhook secret saved.": "Webhook-Secret gespeichert.",
  "Webhook secret removed.": "Webhook-Secret entfernt.",
  "Publishable key saved.": "Öffentlicher Schlüssel gespeichert.",
  "Payments enabled.": "Zahlungen aktiviert.",
  "Payments disabled.": "Zahlungen deaktiviert.",
  Product: "Produkt",
  "Time zone for daily limits and monthly reports, Personal Coach cadence and upload size.":
    "Zeitzone für Tageslimits und Monatsberichte, Personal-Coach-Rhythmus und Upload-Größe.",
  "Time zone": "Zeitzone",
  "Days and months start at midnight in this zone.":
    "Tage und Monate beginnen um Mitternacht in dieser Zone.",
  "Not available on this server yet.":
    "Auf diesem Server noch nicht verfügbar.",
  "Personal Coach: days between new plans":
    "Personal Coach: Tage zwischen neuen Plänen",
  "Personal Coach: new matches for a rewrite":
    "Personal Coach: neue Matches für eine Überarbeitung",
  "Demo upload limit (MB)": "Demo-Upload-Limit (MB)",
  "A player can ask for a new plan after this many days.":
    "Ein Spieler kann nach so vielen Tagen einen neuen Plan anfordern.",
  "…or sooner after this many new matches (also the automatic rewrite).":
    "…oder früher nach so vielen neuen Matches (auch für die automatische Überarbeitung).",
  "Default 500 MB. The web proxy streams uploads up to this size.":
    "Standard 500 MB. Der Web-Proxy leitet Uploads bis zu dieser Größe weiter.",
  "Between 1 and 90 days.": "Zwischen 1 und 90 Tagen.",
  "Between 1 and 50 matches.": "Zwischen 1 und 50 Matches.",
  "Between 1 and 1024 MB.": "Zwischen 1 und 1024 MB.",
};
