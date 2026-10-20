// Español (es) strings of the admin feature, part 2.
export const es2: Record<string, string> = {
  "Period in which the per-network limit applies.":
    "Periodo en el que se aplica el límite por red.",
  "Most AI reviews one account can run per day, whatever its balance.":
    "Máximo de análisis de IA que una cuenta puede hacer por día, tenga el saldo que tenga.",
  "Discounted Deep review": "Análisis Deep con descuento",
  "{purpose} saved. New requests use it immediately.":
    "{purpose} guardado. Las nuevas solicitudes lo usan de inmediato.",
  "Each purpose runs on its own model. Unassigned purposes fall back: Deep review and Monthly report use Quick review, Personal Coach uses Deep review, then the .env defaults.":
    "Cada uso funciona con su propio modelo. Los usos sin asignar recurren a otro: el análisis Deep y el informe mensual usan el del análisis Quick, el Personal Coach usa el del análisis Deep, y después los valores del .env.",
  "Search {n} models": "Buscar entre {n} modelos",
  "Reload the model list": "Recargar la lista de modelos",
  "Loading this provider's models…": "Cargando los modelos de este proveedor…",
  "This provider doesn't list “{model}”. Pick one from the list.":
    "Este proveedor no lista “{model}”. Elige uno de la lista.",
  "Type the model id manually.": "Escribe el id del modelo a mano.",
  "This provider has no model list. Type the model id manually.":
    "Este proveedor no tiene lista de modelos. Escribe el id del modelo a mano.",
  "≈ {cost} per call at list price": "≈ {cost} por llamada a precio de lista",
  "Price not published by this provider.":
    "Este proveedor no publica el precio.",
  "Answered in {ms} ms": "Respondió en {ms} ms",
  "Saved: {model} · {date}": "Guardado: {model} · {date}",
  "Not assigned": "Sin asignar",
  "Save {purpose}": "Guardar {purpose}",
  "Same as Quick review": "Igual que el análisis Quick",
  "Same as Deep review": "Igual que el análisis Deep",
  Assigned: "Asignado",
  "Uses {purpose}": "Usa {purpose}",
  "Falls back to .env": "Recurre al .env",
  "Not configured": "Sin configurar",
  "Personal Coach plans from all of a player's matches (Pro). Your strongest long-context model.":
    "Planes del Personal Coach a partir de todas las partidas de un jugador (Pro). Tu modelo más potente con contexto largo.",
  "We prefilled Extra body with provider.data_collection = \"deny\": OpenRouter then only routes to upstream providers that don't store or train on your prompts (players' match data). Remove it only if you accept that.":
    'Rellenamos el cuerpo extra con provider.data_collection = "deny": así OpenRouter solo usa proveedores que no guardan ni entrenan con tus prompts (datos de partidas de los jugadores). Quítalo solo si lo aceptas.',
  "{n}k context": "{n}k de contexto",
  "no structured outputs": "sin salidas estructuradas",
  Integrations: "Integraciones",
  "Changes apply immediately and are stored encrypted in the database. No restart needed.":
    "Los cambios se aplican al instante y se guardan cifrados en la base de datos. No hace falta reiniciar.",
  "Configured · Database": "Configurado · Base de datos",
  "From .env (read-only bootstrap)": "Desde .env (arranque de solo lectura)",
  "Testing…": "Probando…",
  Connected: "Conectado",
  "{ms} ms": "{ms} ms",
  "Live mode": "Modo real",
  "Test mode": "Modo de prueba",
  "The test failed.": "La prueba falló.",
  "Steam Web API": "Steam Web API",
  "Profiles, avatars and the account checks behind welcome credits.":
    "Perfiles, avatares y las comprobaciones de cuenta detrás de los créditos de bienvenida.",
  "Create a key on the Steam developer page (signed in with the account that owns this site):":
    "Crea una clave en la página de desarrolladores de Steam (con la cuenta dueña de este sitio):",
  "Web API key": "Clave de Web API",
  "Remove the stored Steam key?": "¿Quitar la clave de Steam guardada?",
  Stripe: "Stripe",
  "Plan subscriptions and credit pack checkout.":
    "Suscripciones a planes y compra de paquetes de créditos.",
  "Keys: Stripe Dashboard → Developers → API keys. Webhook: Developers → Webhooks → Add endpoint, then copy its signing secret.":
    "Claves: Stripe Dashboard → Developers → API keys. Webhook: Developers → Webhooks → Add endpoint, y luego copia su signing secret.",
  "Webhook URL": "URL del webhook",
  "Secret key": "Clave secreta",
  "Remove the stored Stripe secret key?":
    "¿Quitar la clave secreta de Stripe guardada?",
  "Webhook signing secret": "Secreto de firma del webhook",
  "Remove the stored webhook secret?":
    "¿Quitar el secreto del webhook guardado?",
  "Publishable key (public)": "Clave publicable (pública)",
  "Accept payments": "Aceptar pagos",
  "When off, checkout buttons show “Coming soon”.":
    "Si está desactivado, los botones de pago muestran “Próximamente”.",
  "Add the secret key first.": "Primero añade la clave secreta.",
  "Add key": "Añadir clave",
  "Save key": "Guardar clave",
  Copy: "Copiar",
  Copied: "Copiado",
  Save: "Guardar",
  "Enter a value.": "Introduce un valor.",
  "Keys never contain spaces.": "Las claves nunca llevan espacios.",
  "A Steam Web API key is 32 hexadecimal characters.":
    "Una clave de Steam Web API tiene 32 caracteres hexadecimales.",
  "Stripe secret keys start with sk_live_, sk_test_ (or rk_ for restricted keys).":
    "Las claves secretas de Stripe empiezan por sk_live_, sk_test_ (o rk_ para claves restringidas).",
  "Stripe webhook secrets start with whsec_.":
    "Los secretos de webhook de Stripe empiezan por whsec_.",
  "Publishable keys start with pk_live_ or pk_test_.":
    "Las claves publicables empiezan por pk_live_ o pk_test_.",
  "Steam key saved.": "Clave de Steam guardada.",
  "Steam key removed.": "Clave de Steam quitada.",
  "Stripe secret key saved.": "Clave secreta de Stripe guardada.",
  "Stripe secret key removed.": "Clave secreta de Stripe quitada.",
  "Webhook secret saved.": "Secreto del webhook guardado.",
  "Webhook secret removed.": "Secreto del webhook quitado.",
  "Publishable key saved.": "Clave publicable guardada.",
  "Payments enabled.": "Pagos activados.",
  "Payments disabled.": "Pagos desactivados.",
  Product: "Producto",
  "Time zone for daily limits and monthly reports, Personal Coach cadence and upload size.":
    "Zona horaria para los límites diarios y los informes mensuales, frecuencia del Personal Coach y tamaño de subida.",
  "Time zone": "Zona horaria",
  "Days and months start at midnight in this zone.":
    "Los días y meses empiezan a medianoche en esta zona.",
  "Not available on this server yet.":
    "Todavía no disponible en este servidor.",
  "Personal Coach: days between new plans":
    "Personal Coach: días entre planes nuevos",
  "Personal Coach: new matches for a rewrite":
    "Personal Coach: partidas nuevas para reescribir",
  "Demo upload limit (MB)": "Límite de subida de demos (MB)",
  "A player can ask for a new plan after this many days.":
    "Un jugador puede pedir un plan nuevo después de estos días.",
  "…or sooner after this many new matches (also the automatic rewrite).":
    "…o antes, tras esta cantidad de partidas nuevas (también la reescritura automática).",
  "Default 500 MB. The web proxy streams uploads up to this size.":
    "500 MB por defecto. El proxy web transmite subidas hasta este tamaño.",
  "Between 1 and 90 days.": "Entre 1 y 90 días.",
  "Between 1 and 50 matches.": "Entre 1 y 50 partidas.",
  "Between 1 and 1024 MB.": "Entre 1 y 1024 MB.",
};
