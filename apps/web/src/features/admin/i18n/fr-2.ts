// Français (fr) strings of the admin feature, part 2.
export const fr2: Record<string, string> = {
  "Period in which the per-network limit applies.":
    "Période pendant laquelle s'applique la limite par réseau.",
  "Most AI reviews one account can run per day, whatever its balance.":
    "Nombre max d'analyses IA par compte et par jour, quel que soit le solde.",
  "Discounted Deep review": "Analyse Deep à prix réduit",
  "{purpose} saved. New requests use it immediately.":
    "{purpose} enregistré. Les nouvelles requêtes l'utilisent immédiatement.",
  "Each purpose runs on its own model. Unassigned purposes fall back: Deep review and Monthly report use Quick review, Personal Coach uses Deep review, then the .env defaults.":
    "Chaque usage a son propre modèle. Les usages non attribués se replient : l'analyse Deep et le rapport mensuel utilisent l'analyse Quick, le Personal Coach utilise l'analyse Deep, puis les valeurs du .env.",
  "Search {n} models": "Rechercher parmi {n} modèles",
  "Reload the model list": "Recharger la liste des modèles",
  "Loading this provider's models…":
    "Chargement des modèles de ce fournisseur…",
  "This provider doesn't list “{model}”. Pick one from the list.":
    "Ce fournisseur ne liste pas « {model} ». Choisis-en un dans la liste.",
  "Type the model id manually.": "Saisis l'id du modèle à la main.",
  "This provider has no model list. Type the model id manually.":
    "Ce fournisseur n'a pas de liste de modèles. Saisis l'id du modèle à la main.",
  "≈ {cost} per call at list price": "≈ {cost} par appel au prix catalogue",
  "Price not published by this provider.":
    "Prix non publié par ce fournisseur.",
  "Answered in {ms} ms": "Réponse en {ms} ms",
  "Saved: {model} · {date}": "Enregistré : {model} · {date}",
  "Not assigned": "Non attribué",
  "Save {purpose}": "Enregistrer {purpose}",
  "Same as Quick review": "Comme l'analyse Quick",
  "Same as Deep review": "Comme l'analyse Deep",
  Assigned: "Attribué",
  "Uses {purpose}": "Utilise {purpose}",
  "Falls back to .env": "Se replie sur le .env",
  "Not configured": "Non configuré",
  "Personal Coach plans from all of a player's matches (Pro). Your strongest long-context model.":
    "Plans du Personal Coach à partir de tous les matchs d'un joueur (Pro). Ton modèle le plus puissant à long contexte.",
  "We prefilled Extra body with provider.data_collection = \"deny\": OpenRouter then only routes to upstream providers that don't store or train on your prompts (players' match data). Remove it only if you accept that.":
    "Nous avons prérempli le corps supplémentaire avec provider.data_collection = \"deny\" : OpenRouter ne passe alors que par des fournisseurs qui ne stockent pas tes prompts et ne s'entraînent pas dessus (données de match des joueurs). Ne le retire que si tu l'acceptes.",
  "{n}k context": "{n}k de contexte",
  "no structured outputs": "pas de sorties structurées",
  Integrations: "Intégrations",
  "Changes apply immediately and are stored encrypted in the database. No restart needed.":
    "Les changements s'appliquent immédiatement et sont stockés chiffrés en base de données. Aucun redémarrage nécessaire.",
  "Configured · Database": "Configuré · Base de données",
  "From .env (read-only bootstrap)":
    "Depuis le .env (démarrage en lecture seule)",
  "Testing…": "Test en cours…",
  Connected: "Connecté",
  "{ms} ms": "{ms} ms",
  "Live mode": "Mode réel",
  "Test mode": "Mode test",
  "The test failed.": "Le test a échoué.",
  "Steam Web API": "Steam Web API",
  "Profiles, avatars and the account checks behind welcome credits.":
    "Profils, avatars et vérifications de compte derrière les crédits de bienvenue.",
  "Create a key on the Steam developer page (signed in with the account that owns this site):":
    "Crée une clé sur la page développeur de Steam (connecté avec le compte propriétaire de ce site) :",
  "Web API key": "Clé Web API",
  "Remove the stored Steam key?": "Supprimer la clé Steam enregistrée ?",
  Stripe: "Stripe",
  "Plan subscriptions and credit pack checkout.":
    "Abonnements aux offres et achat de packs de crédits.",
  "Keys: Stripe Dashboard → Developers → API keys. Webhook: Developers → Webhooks → Add endpoint, then copy its signing secret.":
    "Clés : Stripe Dashboard → Developers → API keys. Webhook : Developers → Webhooks → Add endpoint, puis copie son signing secret.",
  "Webhook URL": "URL du webhook",
  "Secret key": "Clé secrète",
  "Remove the stored Stripe secret key?":
    "Supprimer la clé secrète Stripe enregistrée ?",
  "Webhook signing secret": "Secret de signature du webhook",
  "Remove the stored webhook secret?":
    "Supprimer le secret du webhook enregistré ?",
  "Publishable key (public)": "Clé publiable (publique)",
  "Accept payments": "Accepter les paiements",
  "When off, checkout buttons show “Coming soon”.":
    "Désactivé, les boutons de paiement affichent « Bientôt disponible ».",
  "Add the secret key first.": "Ajoute d'abord la clé secrète.",
  "Add key": "Ajouter une clé",
  "Save key": "Enregistrer la clé",
  Copy: "Copier",
  Copied: "Copié",
  Save: "Enregistrer",
  "Enter a value.": "Saisis une valeur.",
  "Keys never contain spaces.": "Les clés ne contiennent jamais d'espaces.",
  "A Steam Web API key is 32 hexadecimal characters.":
    "Une clé Steam Web API fait 32 caractères hexadécimaux.",
  "Stripe secret keys start with sk_live_, sk_test_ (or rk_ for restricted keys).":
    "Les clés secrètes Stripe commencent par sk_live_, sk_test_ (ou rk_ pour les clés restreintes).",
  "Stripe webhook secrets start with whsec_.":
    "Les secrets de webhook Stripe commencent par whsec_.",
  "Publishable keys start with pk_live_ or pk_test_.":
    "Les clés publiables commencent par pk_live_ ou pk_test_.",
  "Steam key saved.": "Clé Steam enregistrée.",
  "Steam key removed.": "Clé Steam supprimée.",
  "Stripe secret key saved.": "Clé secrète Stripe enregistrée.",
  "Stripe secret key removed.": "Clé secrète Stripe supprimée.",
  "Webhook secret saved.": "Secret du webhook enregistré.",
  "Webhook secret removed.": "Secret du webhook supprimé.",
  "Publishable key saved.": "Clé publiable enregistrée.",
  "Payments enabled.": "Paiements activés.",
  "Payments disabled.": "Paiements désactivés.",
  Product: "Produit",
  "Time zone for daily limits and monthly reports, Personal Coach cadence and upload size.":
    "Fuseau horaire des limites quotidiennes et rapports mensuels, rythme du Personal Coach et taille des imports.",
  "Time zone": "Fuseau horaire",
  "Days and months start at midnight in this zone.":
    "Les jours et les mois commencent à minuit dans ce fuseau.",
  "Not available on this server yet.": "Pas encore disponible sur ce serveur.",
  "Personal Coach: days between new plans":
    "Personal Coach : jours entre deux nouveaux plans",
  "Personal Coach: new matches for a rewrite":
    "Personal Coach : nouveaux matchs pour une réécriture",
  "Demo upload limit (MB)": "Limite d'import des démos (Mo)",
  "A player can ask for a new plan after this many days.":
    "Un joueur peut demander un nouveau plan après ce nombre de jours.",
  "…or sooner after this many new matches (also the automatic rewrite).":
    "…ou plus tôt après ce nombre de nouveaux matchs (aussi pour la réécriture automatique).",
  "Default 500 MB. The web proxy streams uploads up to this size.":
    "500 Mo par défaut. Le proxy web transmet les imports jusqu'à cette taille.",
  "Between 1 and 90 days.": "Entre 1 et 90 jours.",
  "Between 1 and 50 matches.": "Entre 1 et 50 matchs.",
  "Between 1 and 1024 MB.": "Entre 1 et 1024 Mo.",
};
