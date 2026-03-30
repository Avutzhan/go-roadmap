# 🧠 1. Mentoring, Conflict Resolution & Stakeholder Management

## 📌 Что это такое

Staff-инженер влияет через людей, не только через код. Умение растить инженеров, разруливать технические конфликты и управлять ожиданиями стейкхолдеров — обязательные навыки уровня.

---

## 🔬 Глубокий разбор (Senior/Staff)

### Mentoring: от Junior до Senior

```
Ошибка: "Вот правильный ответ, делай так"
Правильно: "Что ты думаешь? Что рассматривал? Давай вместе разберём."

Leveling framework для ментора:
Junior → Mid: 
  - Фокус: самостоятельность на well-defined tasks
  - Метод: pair programming, targeted CR feedback
  - Метрика: "может взять задачу и сделать без постоянных вопросов?"

Mid → Senior:
  - Фокус: ownership и influence beyond own code
  - Метод: поручай им вести технические решения, давай feedback ПОСЛЕ
  - Метрика: "другие приходят к ней за советом?"

Senior → Staff:
  - Фокус: org-wide impact, системное мышление
  - Метод: вовлекай в кросс-командные проекты, RFC reviews
  - Метрика: "влияет ли она на направление инженерной организации?"
```

```
1:1 структура (30 минут/неделю):
10 мин: Как дела — personal wellbeing, blockers
10 мин: Текущие задачи — прогресс, где нужна помощь
10 мин: Growth — что хочет развить, feedback

Правило: 1:1 — это ВРЕМЯ РЕПОРТЕРА, не менеджера.
Менти ведёт agenda. Ментор задаёт вопросы.
```

### Технические конфликты: паттерны разрешения

```
Тип 1: Разногласие по технологии (PostgreSQL vs MongoDB)
→ Не спорить. Проводи Time-boxed PoC (48 часов).
→ Сравни по конкретным критериям (performance, ops overhead, team familiarity)
→ Decision owner принимает решение. Остальные: disagree but commit.

Тип 2: Архитектурный конфликт между командами
→ RFC process: пишем proposal → период комментирования → Tech Forum
→ Используй Trade-off matrix — делает предпочтения явными
→ Если нет консенсуса: escalate к Engineering Manager с вашим recommendation

Тип 3: Interpersonal conflict в команде
→ 1:1 с каждым: "Что происходит? Что нужно чтобы работалось нормально?"
→ Facilitator роль: help parties articulate needs, не выбирать сторону
→ Если не помогает: HR / Engineering Manager
→ Документируй! Особенно если professional boundary violation
```

### Stakeholder Management: Engineering-Product-Business

```
Основная проблема: Engineering говорит на техническом языке,
                   бизнес слышит "мы хотим переписать всё"

Staff-перевод:
Техническое: "Connection pool исчерпывается при нагрузке"
→ Бизнес: "При акциях мы теряем 15% транзакций из-за инфра-проблемы.
           Это стоит ~$50K/день. 3 дня работы = fix."

Техническое: "У нас много технического долга"
→ Бизнес: "Наш change failure rate 30% — каждый третий деплой требует rollback.
           Это ~15h инженеров/месяц. Один квартал на reliability = 6 месяцев без этой проблемы."
```

```
RACI matrix для кросс-командных проектов:
R — Responsible: кто делает работу (Engineers)
A — Accountable: кто отвечает за результат (Tech Lead)
C — Consulted: кто даёт input (Arch review, Security)
I — Informed: кто должен знать (PM, Business, Ops)

Без RACI → "кто за это отвечает?" → friction → задержки
```

### Giving & Receiving Feedback (SBI Framework)

```
SBI = Situation → Behavior → Impact

Плохой feedback:
"Твой код снова недостаточно хорош" (vague, personal)

SBI feedback:
Situation: "На вашем PR #342 вчера"
Behavior: "Я увидел что функция processOrder делает 5 вещей:
           валидация, DB запись, email, log, audit"
Impact: "Это сложно тестировать — в unit test мне нужно мокать 4 зависимости.
         И следующий human который это читает потратит 20 минут чтобы разобраться."

Запрос: "Как смотришь на разделение на 3 функции?"
```

---

## 🔥 Реальные боевые кейсы

- **Mentoring win**: Junior думал что не справится с task. Я не давал ответ — задавал вопросы. За 45 минут она сама пришла к решению. Через квартал — уверена в себе уже со сложными задачами
- **Конфликт команд**: Payment team и Order team спорили кто должен владеть shared Payment model. RFC + RACI: Payment team owns model, Order team = Consulted, interface через API contract
- **Stakeholder translation**: PO хотел 100% feature time. Показал графики: change failure rate + incident cost. Договорились на 20% reliability time. Квартал спустя — PM сам предложил 25%

---

## 💬 Как отвечать на интервью

> "На Staff уровне я думаю о multiplier effect — как мой вклад умножается через других. В менторинге: не давать ответы, а задавать вопросы. В конфликтах: PoC и data вместо opinion wars. Со стейкхолдерами: говорить на языке бизнеса — не 'техдолг', а 'change failure rate стоит нам X$/квартал'. SBI framework для feedback — конкретно, поведенчески, с impact."

---

## ❓ Вопросы для интервью (Senior/Staff)

### Как справиться с "brilliant jerk" в команде (технически сильный, но collaboration nightmare)?

Документируй конкретные incidents (SBI). Прямой разговор: "Хочу поговорить о конкретной ситуации [SBI]. Поведение X имеет impact Y на команду." Дай время изменению. Если не меняется — escalate к менеджеру. Technical excellence не компенсирует team toxicity — Staff инженер понимает что "culture eats strategy for breakfast".

### Как давать critical feedback человеку который не принимает критику?

Cambion: framing as questions вместо statements. "Я заметил X. Что думаешь — почему так получилось?" vs "X — неправильно." Также: "Я хочу дать feedback — это хороший момент?" Consent to feedback снижает defensive реакцию. Если паттерн повторяется — это conversation с менеджером, не только с человеком.

### Как объяснить engineering priorities non-technical CEO?

Используй business metrics, не technical. "Мы хотим улучшить deployment frequency" → "Сейчас путь от идеи до клиентов занимает 3 недели. Конкуренты — 3 дня. Каждый конкурентный фикс они выпустят в 7 раз быстрее нас. Наша инвестиция: 1 квартал → снижение до 3 дней."

---

## 📊 Итоговая шпаргалка

| Ситуация | Инструмент |
|----------|-----------|
| Mentoring | Вопросы, не ответы; SBI feedback |
| Tech conflict | Time-boxed PoC + Trade-off matrix |
| Cross-team conflict | RFC process + RACI |
| Stakeholder mgmt | Business language: метрики + деньги |
| Brilliant jerk | Document → Direct talk → Escalate |
| Critical feedback | SBI + consent to feedback |
| CEO pitch | Business metrics, not tech |
