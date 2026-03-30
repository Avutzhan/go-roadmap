# 🧠 2. Planning, Tech Debt & Roadmap Management

## 📌 Что это такое

Staff-инженер участвует в квартальном планировании не как исполнитель, а как **партнёр бизнеса**: переводит технические риски в бизнес-язык, защищает инженерное время на надёжность, управляет техдолгом системно.

---

## 🔬 Глубокий разбор (Senior/Staff)

### Квартальное планирование: инженерный голос

```
Типичная ошибка: инженеры принимают backlog от product, не задавая вопросов

Staff-подход: приходи с данными

1. Capacity calculation:
   Команда: 6 инженеров × 10 weeks × 0.7 (30% overhead: meetings, incidents, reviews)
   = 42 engineer-weeks productive time

2. Partition бюджета:
   70% Features (бизнес требование)
   20% Tech debt & reliability
   10% Learning & experiments

3. Risk assessment для каждой фичи:
   "Фича X требует изменения shared DB schema — blast radius = 8 сервисов.
    Нужно 2 недели для migration strategy. Это не в estimates PO."
```

### Tech Debt Quantification: переводим на деньги

```
Как обосновать "рефакторинг" перед бизнесом:

Метрика 1: Lead time tax
"Каждое изменение в Payment module занимает 3 дня из-за tight coupling.
 С правильной архитектурой — 1 день.
 Команда 4 человека × 2 дня × 50 изменений/квартал = 400 человеко-дней/год"

Метрика 2: Change failure rate
"30% наших деплоев требуют rollback из-за legacy code.
 Каждый rollback = 2h engineer time × 15 deploys/month = 30h/month wasted"

Метрика 3: Onboarding cost
"Новый инженер → 4 месяца до самостоятельной работы из-за сложности системы.
 С модульной архитектурой → 6 недель (по бенчмарку других команд)"
```

### Eisenhower Matrix для tech work

```
              URGENT          |         NOT URGENT
         _____________________|______________________
IMPOR-  |  Production bug     |  Refactoring         |
TANT    |  Security fix       |  Architecture review  |
        |  → Do NOW           |  → Schedule           |
        |_____________________|______________________|
NOT     |  Some meetings      |  Nice-to-have tools  |
IMPOR-  |  Low-priority alerts|  Premature optimization|
TANT    |  → Delegate/decline |  → Eliminate          |
        |_____________________|______________________|

Staff-задача: защищать "Important but Not Urgent" квадрат (Q2)
Большинство команд живут в Q1 (пожары) и Q4 (иллюзия продуктивности)
```

### OKR для инженерной команды

```
Objective: "Сделать платёжную платформу enterprise-ready"

Key Results:
- KR1: p99 latency < 100ms для 95% платёжных транзакций (было: 320ms) 
- KR2: Deployment frequency: от 2x/month до daily
- KR3: MTTR при инцидентах < 15 минут (было: 45 минут)
- KR4: 0 P0 инцидентов связанных с техдолгом (было: 3/квартал)

Почему это работает лучше чем "deliver X features":
- KR измеримы объективно
- Команда имеет agency по методу достижения
- Связаны с бизнес-ценностью напрямую
```

### Приоритизация tech debt через Risk × Impact

```go
type TechDebtItem struct {
    Title       string
    Risk        int // 1-10: вероятность что это вызовет проблему
    Impact      int // 1-10: насколько сильная проблема
    FixCost     int // engineer-days
    Description string
}

// Priority = Risk × Impact / FixCost
// Высокий риск + высокий impact + дёшево → фиксим первым

items := []TechDebtItem{
    {
        Title:   "Connection pool без circuit breaker",
        Risk:    9,  // высокий: каскадное падение уже было
        Impact:  10, // критично: всё останавливается
        FixCost: 3,  // 3 дня
        // Priority = 90/3 = 30 — TOP приоритет
    },
    {
        Title:   "Устаревший Go 1.18",
        Risk:    3,  // низкий: работает стабильно
        Impact:  5,  // средний: нет новых оптимизаций
        FixCost: 2,  // 2 дня
        // Priority = 15/2 = 7.5
    },
}
```

---

## 🔥 Реальные боевые кейсы

- **Tech debt budget защита**: PO хотел 100% времени на features. Показал: 35% деплоев требуют rollback → аргументировал 20% на reliability → после квартала change failure rate упал с 35% до 8%
- **OKR вместо features**: команда перешла с "deliver N stories" на KR по latency → за квартал p99 Latency: 820ms → 95ms без явного "задания сделать оптимизацию"
- **Q2 защита**: каждую неделю в пятницу — "Platform Friday": только non-feature работа. Нет срочных прерываний. За квартал — 6 significant improvements без снижения feature velocity

---

## 💬 Как отвечать на интервью

> "На планировании я прихожу с данными: capacity в engineer-weeks, risk assessment для каждой фичи, tech debt приоритизация через Risk × Impact / Cost. Я перевожу технические риски в бизнес-язык: не 'нам нужен рефакторинг', а 'наш change failure rate 30% стоит 400 инженеро-дней в год'. Защищаю Q2 工作 — важное но не срочное — потому что команды которые живут только в Q1 burnout и накапливают долг."

---

## ❓ Вопросы для интервью (Senior/Staff)

### Как договориться с PO о выделении времени на tech reliability?

Используй data-driven подход и конвертируй в бизнес-метрики. Не "нам нужно рефакторить" — а "наш текущий change failure rate 30% означает X часов engineer time на rollbacks в квартал, что эквивалентно Y фичам которые мы не сделали." Потом предложи experiment: "Дай нам 20% на reliability этот квартал, измерим change failure rate через 3 месяца."

### Что делать если tech debt растёт быстрее чем команда успевает фиксить?

Это архитектурная проблема. Симптомы: change failure rate > 15%, lead time растёт, engineer dissatisfaction. Решение: freeze new features на 1 sprint для "debt sprint", пересмотр definition of done (включи refactoring в acceptance criteria), введи boy scout rule (всегда оставляй код чище чем нашёл). Если не помогает — нужен engineering freeze и разговор с leadership.

---

## 📊 Итоговая шпаргалка

| Инструмент | Применение |
|-----------|-----------|
| Capacity calculation | Реалистичный scope на квартал |
| Tech debt в $$$ | Убеждаем бизнес инвестировать |
| Eisenhower Matrix | Приоритизация работы команды |
| Risk × Impact / Cost | Выбор что фиксить первым |
| OKR для инженеров | Метрики вместо feature-counts |
| Q2 protection | Platform time без прерываний |
