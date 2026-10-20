// Русский (ru) strings of the coach feature. Keys are the English source texts.
import { ru2 } from "./ru-2";

export const ru: Record<string, string> = {
  "{done} of {total} analyses on parser {v} · {pending} pending · {failed} failed":
    "{done} из {total} анализов на парсере {v} · {pending} в очереди · {failed} с ошибкой",
  "#{r} of {n}": "№{r} из {n}",
  "A player": "Игрок",
  "Admins are never charged.": "С админов кредиты не списываются.",
  "AI quality": "Качество ИИ",
  "Analyses on the current parser": "Анализы на текущем парсере",
  "Analyze my new demos automatically":
    "Анализировать мои новые демо автоматически",
  "Automatic reviews are off.": "Автоматические разборы выключены.",
  "Automatic reviews are on.": "Автоматические разборы включены.",
  "Automatic reviews": "Автоматические разборы",
  "Average latency": "Средняя задержка",
  Average: "Среднее",
  "Back to my review": "Назад к моему разбору",
  "Claims the match facts don't support are corrected or dropped. Uses the “Claim verifier” AI assignment.":
    "Утверждения, которые не подтверждаются данными матча, исправляются или удаляются. Использует назначение ИИ «Проверка утверждений».",
  Cost: "Стоимость",
  "Each automatic review uses credits. If you don't have enough, it is skipped and the match shows “Not enough credits”. Demos you're not in are never reviewed.":
    "Каждый автоматический разбор тратит кредиты. Если их не хватает, разбор пропускается, а матч показывает «Недостаточно кредитов». Демки, где тебя нет, не разбираются.",
  "Every player's role": "Роль каждого игрока",
  "Grounded claims": "Подтверждённые утверждения",
  "How players rate each prompt version, and the latest automated check of grounding, language and cost.":
    "Как игроки оценивают каждую версию промпта, и последняя автоматическая проверка обоснованности, языка и стоимости.",
  "Key rounds": "Ключевые раунды",
  "Latest eval": "Последняя оценка",
  "Match integrity": "Честность матча",
  Prompt: "Промпт",
  Purpose: "Задача",
  Rated: "С оценкой",
  Ratings: "Оценки",
  "Rejected by the verifier": "Отклонено проверкой",
  "Report in game via the scoreboard.": "Пожалуйся в игре через таблицу счёта.",
  "Right language": "Правильный язык",
  "Round {n}: {title}": "Раунд {n}: {title}",
  Runs: "Запуски",
  "Statistically unusual aim": "Статистически необычный аим",
  "Statistically unusual player. This death doesn't count against you":
    "Статистически необычный игрок. Эта смерть не засчитана против тебя",
  "Team patterns": "Паттерны команды",
  "Team plan for the next match": "План команды на следующий матч",
  "Team review cost": "Цена командного разбора",
  "Team scores vs the enemy team": "Оценки команды против соперника",
  Teammate: "Тиммейт",
  "The team review could not be finished.":
    "Командный разбор не удалось завершить.",
  "This is a statistical signal, not proof. Deaths to these players aren't counted against you.":
    "Это статистический сигнал, а не доказательство. Смерти от этих игроков не засчитываются против тебя.",
  "To fix": "Исправить",
  Variant: "Вариант",
  "Verify every review's claims with a second AI pass":
    "Проверять утверждения каждого разбора вторым проходом ИИ",
  "What to do instead": "Что делать вместо этого",
  "When a demo of yours finishes processing, the AI Coach reviews it right away.":
    "Когда твоя демка обработана, ИИ-коуч сразу её разбирает.",
  "Whole team": "Вся команда",
  "You {v} · lobby {m} · best {b}": "Ты {v} · лобби {m} · лучший {b}",
  "You vs the lobby": "Ты против лобби",
  "Your place among the {n} players of this match (1 = best).":
    "Твоё место среди {n} игроков этого матча (1 = лучший).",
  "Your team, reviewed": "Твоя команда под разбором",
  "{k} very fast snaps landing exactly on the head (in {n} fights)":
    "{k} очень быстрых флика точно в голову (в {n} перестрелках)",
  "Headshot rate far above the rest of the lobby ({n} kills)":
    "Процент хедшотов намного выше остального лобби ({n} убийств)",
  "Unusually many head hits per shot ({n} shots)":
    "Необычно много попаданий в голову на выстрел ({n} выстрелов)",
  "Hit back in {ms} ms on average after being shot ({n} times)":
    "Отвечал в среднем за {ms} мс после попадания по нему ({n} раз)",
  "{pct}% of kills through smoke or walls ({n} kills)":
    "{pct}% убийств сквозь смок или стены ({n} убийств)",
  "Statistically unusual play": "Статистически необычная игра",
  "Account banned by VAC {d} days after this match":
    "Аккаунт получил VAC-бан через {d} дн. после этого матча",
  "Account received a game ban {d} days after this match":
    "Аккаунт получил игровой бан через {d} дн. после этого матча",
  "Account banned by VAC after this match":
    "Аккаунт получил VAC-бан после этого матча",
  "Account received a game ban after this match":
    "Аккаунт получил игровой бан после этого матча",
  Entry: "Энтри",
  Support: "Саппорт",
  Lurker: "Лёркер",
  AWPer: "Снайпер",
  Anchor: "Опорник",
  Flex: "Флекс",
  Openings: "Первые дуэли",
  "Converting advantages": "Реализация преимущества",
  "Run Team review": "Запустить командный разбор",
  "Five players, one game plan": "Пять игроков, один план на игру",
  "Your whole team, reviewed like an IGL would":
    "Вся твоя команда под разбором, как это сделал бы IGL",
  "Team scores: trading, utility, openings, economy, conversion":
    "Оценки команды: трейды, гранаты, первые дуэли, экономика, реализация",
  "Each player's role with strengths and fixes":
    "Роль каждого игрока с сильными сторонами и исправлениями",
  "Key rounds with 2D clips": "Ключевые раунды с 2D-клипами",
  "A team plan with who does what": "План команды: кто что делает",
  New: "Новое",
  "Claim verifier": "Проверка утверждений",
  "Team review: the IGL view of a whole team. A strong model with a large context.":
    "Командный разбор: взгляд IGL на всю команду. Сильная модель с большим контекстом.",
  "Double-checks every claim of a review against the match facts. A fast, cheap model is enough.":
    "Перепроверяет каждое утверждение разбора по данным матча. Хватит быстрой и дешёвой модели.",
  "Credits per Team review (Pro pays one less).":
    "Кредитов за командный разбор (Pro платит на один меньше).",
  "{traded} of {deaths} traded": "трейд у {traded} из {deaths}",
  "nearest teammate about {m} m away on average":
    "ближайший тиммейт в среднем примерно в {m} м",
  "{n, plural, one {# death} other {# deaths}} in a crossfire":
    "{n, plural, one {# смерть} few {# смерти} many {# смертей} other {# смерти}} под перекрёстным огнём",
  "{nade} into {place}": "{nade} на {place}",
  "{nade} at {place}": "{nade} на {place}",
  "Round {round}: blinded {n, plural, one {# enemy} other {# enemies}} for {s} s.":
    "Раунд {round}: ослепил {n, plural, one {# врага} few {# врагов} many {# врагов} other {# врага}} на {s} с.",
  "Round {round}: {damage} damage.": "Раунд {round}: {damage} урона.",
  "The lobby threw it here {n, plural, one {once} other {# times}}; you died here {d, plural, one {once} other {# times}}.":
    "Лобби кидало сюда {n, plural, one {# раз} few {# раза} many {# раз} other {# раза}}; ты умер здесь {d, plural, one {# раз} few {# раза} many {# раз} other {# раза}}.",
  "Thrown from {place}.": "Брошена с {place}.",
  "Multi-kill": "Мультикилл",
  "You got two or more kills this round.":
    "Ты сделал два или больше убийств за этот раунд.",
  "Clutch won": "Клатч выигран",
  "You were the last one alive and won the round.":
    "Ты остался последним и выиграл раунд.",
  "You got the first kill of the round.": "Ты сделал первое убийство раунда.",
  "First death": "Первая смерть",
  "You were the first player to die this round.":
    "Ты умер первым в этом раунде.",
  "Untraded death": "Смерть без трейда",
  "No teammate killed your killer within 5 seconds.":
    "Ни один тиммейт не убил твоего убийцу за 5 секунд.",
  "Early death": "Ранняя смерть",
  "You died in the first 20 seconds of the round.":
    "Ты умер в первые 20 секунд раунда.",
  "You died without damaging an enemy.":
    "Ты умер, не нанеся урона ни одному врагу.",
  "Unused utility": "Неиспользованные гранаты",
  "You died with two or more grenades still in your inventory.":
    "Ты умер с двумя или больше гранатами в инвентаре.",
  "Pistol round": "Пистолетный раунд",
  "Force buy": "Форс",
  "Buy type": "Тип закупа",
  "Enemies blinded per flash": "Ослеплено врагов за флешку",
  "Team-flash rate": "Доля флешек в своих",
  "{n, plural, one {# kill} other {# kills}}":
    "{n, plural, one {# убийство} few {# убийства} many {# убийств} other {# убийства}}",
  "opening duel": "первая дуэль",
  untraded: "без трейда",
  "at {place}": "на {place}",
  "Crosshair already on the enemy in {n} of {total} duels":
    "Прицел уже на враге в {n} из {total} дуэлей",
  "{place}: crosshair off target in {n} of {total} duels":
    "{place}: прицел мимо цели в {n} из {total} дуэлей",
  "Where your crosshair was when each duel started":
    "Где был твой прицел в начале каждой дуэли",
  "Duel won": "Дуэль выиграна",
  "Duel lost": "Дуэль проиграна",
  "No winner": "Без победителя",
  "Your crosshair tends to sit too high, above the head.":
    "Твой прицел обычно слишком высоко, над головой.",
  "Lower it a touch: aim where heads appear, not over them.":
    "Опусти его чуть ниже: целься туда, где появляются головы, а не выше.",
  "Your crosshair usually sits at head height.":
    "Твой прицел обычно на уровне головы.",
  "Good height. Keep it there while you move.":
    "Хорошая высота. Держи её и в движении.",
  "Your crosshair tends to sit a little low: around neck height.":
    "Твой прицел обычно чуть низковат: на уровне шеи.",
  "Raise it slightly so the first bullet goes to the head.":
    "Подними его немного, чтобы первая пуля шла в голову.",
  "Your crosshair tends to sit low: around chest height.":
    "Твой прицел обычно низко: на уровне груди.",
  "Raise it to head height before you peek.":
    "Поднимай его на уровень головы перед пиком.",
  "Your crosshair tends to sit very low: around stomach height.":
    "Твой прицел обычно очень низко: на уровне живота.",
  "Raise it to head height before you peek; check it every time you stop.":
    "Поднимай его на уровень головы перед пиком; проверяй каждый раз, когда останавливаешься.",
  "Your crosshair tends to sit very low: around the legs.":
    "Твой прицел обычно очень низко: на уровне ног.",
  "It also tends to be to the left of where enemies appear: check the other side of the angle first.":
    "Ещё он часто левее места, где появляются враги: сначала проверяй другую сторону угла.",
  "It also tends to be to the right of where enemies appear: check the other side of the angle first.":
    "Ещё он часто правее места, где появляются враги: сначала проверяй другую сторону угла.",
  "On target": "В цель",
  "Your crosshair was already on the enemy.": "Прицел уже был на враге.",
  Near: "Рядом",
  "One small adjustment away.": "Нужна небольшая доводка.",
  "Big flick": "Большой флик",
  "You needed a big flick.": "Нужен был большой флик.",
  "Duels with the crosshair already on the enemy":
    "Дуэли с прицелом уже на враге",
  "Crosshair already on the enemy": "Прицел уже на враге",
  Strength: "Сильная сторона",
  "To improve": "Что улучшить",
  "Your AI coach": "Твой ИИ-коуч",
  "Pick a match and a player. The coach reviews every round and shows you the moments that matter in 2D replay.":
    "Выбери матч и игрока. Коуч разберёт каждый раунд и покажет важные моменты в 2D-повторе.",
  "Choose a match": "Выбери матч",
  "No analyzed matches yet": "Проанализированных матчей пока нет",
  "Upload a demo and come back: the coach needs a match to review.":
    "Загрузи демо и возвращайся: коучу нужен матч для разбора.",
  Change: "Сменить",
  "Change match": "Сменить матч",
  "Choose the player": "Выбери игрока",
  "Who should the coach review?": "Кого должен разобрать коуч?",
  "Started as CT": "Начал за CT",
  "Started as T": "Начал за T",
  Match: "Матч",
  Review: "Разбор",
  Steps: "Шаги",
  Reviewed: "Разобрано",
  "Choose the player to review": "Выбери игрока для разбора",
  "The coach is offline right now": "Коуч сейчас недоступен",
  "The review could not be finished.": "Разбор не удалось завершить.",
  "Please try again later.": "Попробуй позже.",
  "Reading {n} events…": "Читаю {n} событий…",
  "Tracking your crosshair…": "Слежу за твоим прицелом…",
  "Mapping every duel you took…": "Отмечаю каждую твою дуэль…",
  "Checking who traded whom…": "Проверяю, кто кого разменял…",
  "Counting your utility…": "Считаю твои гранаты…",
  "Calling the IGL…": "Вызываю IGL…",
  "Comparing you with the lobby…": "Сравниваю тебя с лобби…",
  "Checking every claim against the demo…":
    "Сверяю каждое утверждение с демкой…",
  "Writing your plan for the next match…": "Пишу твой план на следующий матч…",
  "{coach} is reviewing {name}": "{coach} разбирает игру {name}",
  "A real review takes 10 to 60 seconds. Keep this tab open.":
    "Настоящий разбор занимает от 10 до 60 секунд. Не закрывай вкладку.",
  "Your match, reviewed": "Твой матч разобран",
  "Saved review from {date}": "Сохранённый разбор от {date}",
  "Overall score {n} of 100": "Общая оценка {n} из 100",
  Overall: "Общая",
  "Your scores vs the lobby": "Твои оценки против лобби",
  "Lobby average": "Среднее по лобби",
  "Key moments": "Ключевые моменты",
  Priorities: "Приоритеты",
  "The coach found nothing it could back with evidence for this player.":
    "Коуч не нашёл ничего, что мог бы подтвердить данными по этому игроку.",
  Drills: "Упражнения",
  "Ask again": "Спросить снова",
  "Open match analysis": "Открыть анализ матча",
  "Watch clip": "Смотреть клип",
  Highlight: "Хайлайт",
  Mistake: "Ошибка",
  Instead: "Вместо этого",
  "About {n} minutes in total": "Всего около {n} минут",
  "{done} of {n} done": "Готово {done} из {n}",
  "{n} min": "{n} мин",
  Goal: "Цель",
  "Get {name}'s full review": "Получи полный разбор {name}",
  "Scores against the lobby, key moments as 2D replays, drills and a plan for your next match.":
    "Оценки против лобби, ключевые моменты в 2D-повторе, упражнения и план на следующий матч.",
  "Open in the coach": "Открыть в коуче",
  Players: "Игроки",
  "Evidence: rounds {rounds}": "Данные: раунды {rounds}",
  "Evidence: {n} metric(s)": "Данные: метрик {n}",
  "Keep doing": "Продолжай",
  "Limits of this review": "Ограничения этого разбора",
  Practice: "Тренировка",
  "Review for {name}": "Разбор для {name}",
  "Plan for your next match": "План на следующий матч",
  "Saved to your progress.": "Сохранено в твой прогресс.",
  ...ru2,
};
