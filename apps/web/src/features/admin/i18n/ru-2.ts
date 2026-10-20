// Русский (ru) strings of the admin feature, part 2.
export const ru2: Record<string, string> = {
  "Discounted Deep review": "Deep-разбор со скидкой",
  "{purpose} saved. New requests use it immediately.":
    "{purpose} сохранено. Новые запросы сразу используют это.",
  "Each purpose runs on its own model. Unassigned purposes fall back: Deep review and Monthly report use Quick review, Personal Coach uses Deep review, then the .env defaults.":
    "Каждая задача работает на своей модели. Без назначения задачи используют запасной вариант: Deep-разбор и ежемесячный отчёт берут модель Quick-разбора, Personal Coach берёт модель Deep-разбора, затем значения из .env.",
  "Search {n} models": "Поиск среди {n} моделей",
  "Reload the model list": "Обновить список моделей",
  "Loading this provider's models…": "Загружаю модели этого провайдера…",
  "This provider doesn't list “{model}”. Pick one from the list.":
    "Этот провайдер не перечисляет «{model}». Выбери модель из списка.",
  "Type the model id manually.": "Введи id модели вручную.",
  "This provider has no model list. Type the model id manually.":
    "У этого провайдера нет списка моделей. Введи id модели вручную.",
  "≈ {cost} per call at list price": "≈ {cost} за вызов по прайсу",
  "Price not published by this provider.": "Провайдер не публикует цену.",
  "Answered in {ms} ms": "Ответ за {ms} мс",
  "Saved: {model} · {date}": "Сохранено: {model} · {date}",
  "Not assigned": "Не назначено",
  "Save {purpose}": "Сохранить {purpose}",
  "Same as Quick review": "Как у Quick-разбора",
  "Same as Deep review": "Как у Deep-разбора",
  Assigned: "Назначено",
  "Uses {purpose}": "Использует {purpose}",
  "Falls back to .env": "Берёт из .env",
  "Not configured": "Не настроено",
  "Personal Coach plans from all of a player's matches (Pro). Your strongest long-context model.":
    "Планы Personal Coach по всем матчам игрока (Pro). Самая сильная модель с длинным контекстом.",
  "We prefilled Extra body with provider.data_collection = \"deny\": OpenRouter then only routes to upstream providers that don't store or train on your prompts (players' match data). Remove it only if you accept that.":
    'Мы заполнили дополнительное тело параметром provider.data_collection = "deny": тогда OpenRouter отправляет запросы только провайдерам, которые не хранят промпты и не обучаются на них (данные матчей игроков). Удаляй это, только если согласен на обратное.',
  "{n}k context": "контекст {n}k",
  "no structured outputs": "без структурированного вывода",
  Integrations: "Интеграции",
  "Changes apply immediately and are stored encrypted in the database. No restart needed.":
    "Изменения применяются сразу и хранятся в базе в зашифрованном виде. Перезапуск не нужен.",
  "Configured · Database": "Настроено · База данных",
  "From .env (read-only bootstrap)":
    "Из .env (только чтение, начальная настройка)",
  "Testing…": "Проверка…",
  Connected: "Подключено",
  "{ms} ms": "{ms} мс",
  "Live mode": "Боевой режим",
  "Test mode": "Тестовый режим",
  "The test failed.": "Проверка не удалась.",
  "Steam Web API": "Steam Web API",
  "Profiles, avatars and the account checks behind welcome credits.":
    "Профили, аватары и проверки аккаунта для приветственных кредитов.",
  "Create a key on the Steam developer page (signed in with the account that owns this site):":
    "Создай ключ на странице разработчика Steam (войдя под аккаунтом владельца этого сайта):",
  "Web API key": "Ключ Web API",
  "Remove the stored Steam key?": "Удалить сохранённый ключ Steam?",
  Stripe: "Stripe",
  "Plan subscriptions and credit pack checkout.":
    "Подписки на тарифы и покупка пакетов кредитов.",
  "Keys: Stripe Dashboard → Developers → API keys. Webhook: Developers → Webhooks → Add endpoint, then copy its signing secret.":
    "Ключи: Stripe Dashboard → Developers → API keys. Вебхук: Developers → Webhooks → Add endpoint, затем скопируй его signing secret.",
  "Webhook URL": "URL вебхука",
  "Secret key": "Секретный ключ",
  "Remove the stored Stripe secret key?":
    "Удалить сохранённый секретный ключ Stripe?",
  "Webhook signing secret": "Секрет подписи вебхука",
  "Remove the stored webhook secret?": "Удалить сохранённый секрет вебхука?",
  "Publishable key (public)": "Публичный ключ",
  "Accept payments": "Принимать платежи",
  "When off, checkout buttons show “Coming soon”.":
    "Если выключено, кнопки оплаты показывают «Скоро».",
  "Add the secret key first.": "Сначала добавь секретный ключ.",
  "Add key": "Добавить ключ",
  "Save key": "Сохранить ключ",
  Copy: "Копировать",
  Copied: "Скопировано",
  Save: "Сохранить",
  "Enter a value.": "Введи значение.",
  "Keys never contain spaces.": "В ключах не бывает пробелов.",
  "A Steam Web API key is 32 hexadecimal characters.":
    "Ключ Steam Web API состоит из 32 шестнадцатеричных символов.",
  "Stripe secret keys start with sk_live_, sk_test_ (or rk_ for restricted keys).":
    "Секретные ключи Stripe начинаются с sk_live_, sk_test_ (или rk_ для ограниченных ключей).",
  "Stripe webhook secrets start with whsec_.":
    "Секреты вебхуков Stripe начинаются с whsec_.",
  "Publishable keys start with pk_live_ or pk_test_.":
    "Публичные ключи начинаются с pk_live_ или pk_test_.",
  "Steam key saved.": "Ключ Steam сохранён.",
  "Steam key removed.": "Ключ Steam удалён.",
  "Stripe secret key saved.": "Секретный ключ Stripe сохранён.",
  "Stripe secret key removed.": "Секретный ключ Stripe удалён.",
  "Webhook secret saved.": "Секрет вебхука сохранён.",
  "Webhook secret removed.": "Секрет вебхука удалён.",
  "Publishable key saved.": "Публичный ключ сохранён.",
  "Payments enabled.": "Платежи включены.",
  "Payments disabled.": "Платежи выключены.",
  Product: "Продукт",
  "Time zone for daily limits and monthly reports, Personal Coach cadence and upload size.":
    "Часовой пояс для дневных лимитов и ежемесячных отчётов, частота Personal Coach и размер загрузки.",
  "Time zone": "Часовой пояс",
  "Days and months start at midnight in this zone.":
    "Дни и месяцы начинаются в полночь по этому поясу.",
  "Not available on this server yet.": "На этом сервере пока недоступно.",
  "Personal Coach: days between new plans":
    "Personal Coach: дней между новыми планами",
  "Personal Coach: new matches for a rewrite":
    "Personal Coach: новых матчей для переписывания",
  "Demo upload limit (MB)": "Лимит загрузки демо (МБ)",
  "A player can ask for a new plan after this many days.":
    "Игрок может запросить новый план через столько дней.",
  "…or sooner after this many new matches (also the automatic rewrite).":
    "…или раньше, после стольких новых матчей (это же условие для автоматического обновления).",
  "Default 500 MB. The web proxy streams uploads up to this size.":
    "По умолчанию 500 МБ. Веб-прокси передаёт загрузки до этого размера.",
  "Between 1 and 90 days.": "От 1 до 90 дней.",
  "Between 1 and 50 matches.": "От 1 до 50 матчей.",
  "Between 1 and 1024 MB.": "От 1 до 1024 МБ.",
};
