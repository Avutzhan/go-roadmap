# 🧠 2. Execution Under Uncertainty & Technical Decision Making

## 📌 Что это такое

Staff-инженер принимает решения с неполной информацией под давлением дедлайнов. Умение это делать — отличительная черта уровня. Это не про то чтобы всегда быть правым, а про то как структурировать мышление и двигаться вперёд.

---

## 🔬 Глубокий разбор (Senior/Staff)

### Reversible vs Irreversible: скорость решения

```
Модель Amazon Two-way/One-way Door:

One-way door (irreversible, >1 month to undo):
- Выбор primary database (PostgreSQL vs MongoDB)
- Выбор messaging platform (Kafka vs RabbitMQ → инвестиция в экспертизу)
- Публичный API контракт (breaking changes = клиенты сломаются)
→ Требует: RFC, trade-off matrix, консенсус, 1-2 недели

Two-way door (reversible, можно откатить быстро):
- Выбор logging library (zerolog vs zap)
- Feature flag для нового поведения
- Конфигурация timeouts
→ Требует: 30-минутное обсуждение с 1 человеком, decision log

Ошибка: тратить One-way door attention на Two-way door decisions
→ команда парализована бесконечными обсуждениями формата конфига
```

### Как принимать решения при неопределённости

```
Фреймворк для нового требования с неясной реализацией:

1. Clarify: задаём вопросы (5-10 минут)
   "Данные должны быть consistent или eventual OK?"
   "Сколько пользователей одновременно?"
   "Это MVP или Final Design?"

2. Bound: ограничиваем пространство решений
   "При < 10K RPS Postgres достаточно, Kafka преждевременна"
   "При требовании строгой consistency Cassandra исключена"

3. Time-box: ставим время на принятие решения
   "У нас 48 часов чтобы выбрать DB — после этого пишем PoC"

4. Spikes: технические исследования с фиксированным временем
   "2 дня: один человек PoC с PostgreSQL, другой с MongoDB → сравниваем"

5. Decide and document:
   "Выбираем PostgreSQL. Revisit если writes > 50K/sec"
   → ADR с revisit conditions
```

### Управление техническим долгом при давлении дедлайна

```go
// Паттерн: явный tech debt через код + tracking

// ❌ Молчаливый debt
func processOrder(order *Order) error {
    // Это не работает для multi-currency, но ладно пока
    return calculateTax(order.Amount)
}

// ✅ Явный debt
// TODO(tech-debt): TICKET-1234 - Multi-currency support
// Current: assumes USD only, will fail for EUR orders
// Risk: Medium - affects EU expansion (Q3 2024)
// Workaround: EU orders disabled via feature flag (Flag: enable_eu_orders)
func processOrder(order *Order) error {
    if order.Currency != "USD" {
        return ErrCurrencyNotSupported // защита через feature flag
    }
    return calculateTax(order.Amount)
}
```

```
Tech debt prioritization matrix:

HIGH impact + HIGH frequency → Fix immediately
HIGH impact + LOW frequency → Plan in next quarter  
LOW impact + HIGH frequency → Fix when passing by (boy scout rule)
LOW impact + LOW frequency  → Document and ignore

Impact = blast radius если сломается
Frequency = как часто это path исполняется
```

### Spike-based estimation: как не лгать на планировании

```
Ситуация: PO хочет estimate для интеграции с новым Payment Provider
Проблема: неизвестно качество их API

Плохой ответ: "3 дня" (без изучения API)

Правильный ответ (Staff level):
"Я проведу 4-часовой spike: изучу их документацию, напишу hello-world интеграцию.
После spike дам estimate с диапазоном: 
- Best case (хорошее API): 3 дня
- Expected (типичное): 5 дней  
- Worst case (плохое): 8 дней + Tech risk: API может не поддерживать idempotency"

После spike: "API не поддерживает idempotency out-of-box.
Нам нужно строить idempotency layer. Estimate: 7-9 дней."
```

---

## 🔥 Реальные боевые кейсы

- **Дедлайн vs качество**: PO требовал фичу к пятнице. Я предложил feature flag + minimal implementation (без edge cases) + documented tech debt. Запустили в срок, фикс edge cases — следующий sprint
- **Ambiguous requirement решение**: "Делай как Facebook" — попросил конкретные метрики. Получили "1M users, read-heavy, likes/comments". Правильно спроектировали с самого начала
- **Spike предотвратил catastrophe**: spike на интеграцию с banking API показал — они требуют IP whitelist + manual approval 2 недели. Это было в scope M1, пришлось переприоритизировать

---

## 💬 Как отвечать на интервью

> "При неопределённости я использую Time-boxed Spikes: 2-4 часа исследования → конкретные варианты с trade-offs. Для decisions: явно раздельяю One-way door (нужен анализ) и Two-way door (решаем быстро). Tech debt — всегда явный: comment с ticket, impact assessment, workaround. Это даёт команде прозрачность а не 'черные ящики' в коде."

---

## ❓ Вопросы для интервью (Senior/Staff)

### Как работать с PO который хочет невозможное за нереальный срок?

Первый шаг: понять а можно ли разбить на фазы? "Хочу всё за неделю" → "Что из этого даёт 80% бизнес-ценности?" → часто это 20% объёма. Если нет — показываю риски: "Если сделаем за неделю с техдолгом — следующий квартал потратим на фиксы. Давай сделаем правильно за 2 недели." Используй данные: change failure rate, прошлые инциденты от спешки.

### Как принимать решения когда нет времени на анализ (горит прод)?

Incident decision making: разные правила. Prefer safe rollback over untested fix. Если rollback невозможен — smallest safe change. Документируй всё в real-time в incident channel. Post-incident: полный анализ. В кризисе: "move fast and document" — потом разберёмся. Не в кризисе: "move thoughtfully."

### Как справиться с "анализ-параличом" в команде?

Установи Decision Deadline. "К пятнице мы выбираем DB. Если нет консенсуса — Decision Owner принимает решение." Задокументируй в ADR с обоснованием. Disagree but commit — после принятия решения все исполняют, даже несогласные. Это разблокирует работу при сохранении psychological safety.

---

## 📊 Итоговая шпаргалка

| Ситуация | Инструмент |
|----------|-----------|
| Сложное decision | One/Two-way door оценка |
| Неизвестная задача | Time-boxed Spike (2-4ч) |
| Estimate при неопределённости | Best/Expected/Worst case range |
| Tech debt | Явные TODO с ticket + impact |
| Команда в параличе | Decision Deadline + ADR |
| Дедлайн давит | Feature flag + MVP + documented debt |
| Инцидент | Safe rollback first, анализ потом |
