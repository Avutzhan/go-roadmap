# 🧠 2. Real-World STAR Stories: Ready-to-Use Templates

## 📌 Что это такое

Готовые STAR-шаблоны для типичных Senior/Staff Go-backend ситуаций. Адаптируй цифры под свой реальный опыт — важно иметь конкретные детали. Интервьюер проверяет глубину, а не факт истории.

---

## 📖 История 1: Performance Crisis (High-Load)

> **Вопрос**: "Расскажи о ситуации когда тебе пришлось решить серьёзную проблему производительности."

**Situation**: Платёжный сервис обрабатывал 3000 rps в нормальном режиме. Во время акции нагрузка выросла до 12000 rps. p99 latency поднялась с 80мс до 8 секунд, началось каскадное падение зависимых сервисов.

**Task**: Найти bottleneck и восстановить SLO (p99 < 200мс) без deployment нового кода — только конфиг.

**Action**:
1. Подключил pprof к live сервису (`go tool pprof http://service/debug/pprof/goroutine`) — увидел 40K заблокированных горутин
2. Определил: все ждут на `sql.DB` — connection pool исчерпан
3. `MaxOpenConns` был 10 (дефолт) — DB принимала 200 connections
4. Увеличил `MaxOpenConns=80, MaxIdleConns=40, ConnMaxLifetime=5min` через env var без рестарта (golang hot-reload через SIGHUP)
5. Параллельно добавил `circuit breaker` на вызовы payment-gateway чтобы защитить от cascading failure

**Result**: p99 вернулся к 95мс в течение 3 минут. 0 потерянных транзакций (идемпотентные retry клиентов). На следующий день добавили HPA для автоскейлинга при CPU > 70%.

---

**💬 Ключевая фраза**: *"Данные pprof показали точный rootcause — это было не 'нам кажется', это был факт. Я изменил только конфиг, не код, что позволило решить проблему за 3 минуты без деплоя."*

---

## 📖 История 2: Architecture Design (System Design фаза)

> **Вопрос**: "Расскажи о самом сложном архитектурном решении которое ты принимал."

**Situation**: Команда заказов (7 инженеров) работала с монолитом на PHP. Монолит обрабатывал заказы, платежи, инвентарь, нотификации — всё в одном процессе. Любое изменение в одной части ломало другие. Deploy раз в 2 недели, каждый деплой — 3ч downtime.

**Task**: Мне как Lead Backend нужно было предложить стратегию перехода, которая не остановит разработку продукта на месяцы.

**Action**:
1. Провёл Domain Discovery workshops с командой → определили 4 bounded contexts
2. Предложил Strangler Fig: начать с Order Processing (самый частый bottleneck)
3. Написал RFC с trade-off matrix (Monolith→Microservice vs Modular Monolith vs Big Bang rewrite)
4. Выбрал Strangler Fig: новый Go-сервис за API Gateway, dual-write через Kafka для синхронизации с монолитом
5. Canary: 1% трафика → 10% → 50% → 100% за 6 недель
6. Вёл еженедельные architecture reviews для выравнивания команды

**Result**: За 4 месяца мигрировали Order Processing сервис. Deploy time с 3h до 12 минут. Change failure rate упал с 40% до 8%. Дали команде шаблон для следующих миграций.

---

**💬 Ключевая фраза**: *"Самым важным было не техническое решение, а процесс: trade-off matrix сделал альтернативы явными и дал команде ownership над решением. Люди защищают то что помогли создать."*

---

## 📖 История 3: Technical Disagreement (Leadership)

> **Вопрос**: "Расскажи о ситуации когда ты не соглашался с техническим решением команды."

**Situation**: Коллеги предложили использовать Event Sourcing для всех сервисов платформы после прочтения книги. Я видел что это overfitting: большинство наших сервисов — обычные CRUD домены без требований к истории.

**Task**: Убедить команду из 5 senior-инженеров не применять Event Sourcing повсеместно, сохранив при этом хорошие отношения.

**Action**:
1. Не сказал просто "нет" — попросил провести Proof of Concept для Order Service (самый сложный)
2. Сам написал PoC с Event Sourcing для Order Service — показал реальную сложность: snapshot management, projection performance
3. Подготовил comparison: Event Sourcing vs традиционный подход по метрикам: time to implement, query complexity, team cognitive load
4. Proposed: Event Sourcing только для Financial Audit Service (где история критична по compliance), остальные — traditional state
5. Вынес решение в RFC, команда проголосовала

**Result**: Приняли selective approach. Financial audit — Event Sourcing. Остальные — CRUD. Через квартал новый инженер за 2 дня онбордился на CRUD сервис, и за 2 недели — на ES audit сервис. Это подтвердило разницу в сложности.

---

**💬 Ключевая фраза**: *"Я не просто возражал — я построил доказательство. PoC занял 3 дня, но дал нам данные вместо мнений. Disagree but commit — после RFC я полностью поддержал принятое решение."*

---

## 📖 История 4: Crisis & Learning (Incident)

> **Вопрос**: "Расскажи о самом серьёзном production инциденте в твоей карьере."

**Situation**: Пятница, 17:30. Payment API вернула 100% ошибок в течение 8 минут. 0 транзакций обработано. Потеря ~$240K revenue.

**Task**: Восстановить сервис, провести post-mortem, предотвратить повторение.

**Action (во время инцидента)**:
1. Объявил P0, собрал incident channel в Slack
2. Откатил последний деплой (был 20 минут назад) — не помогло
3. Проверил DB connections — в норме
4. Нашёл: новая версия Redis client `v9.0` автоматически использовала `WAIT` команду которой не было в нашей Redis v5
5. Откатил Redis client до `v8.11` → 100% recovery за 3 минуты

**Action (post-mortem)**:
1. Blameless post-mortem на следующий день
2. Root cause: отсутствие staging environment с той же версией Redis
3. Contributing: нет dependency security scan в CI
4. Action items: Renovate bot для dep updates + staging parity matrix + автоматический smoke test после deploy

**Result**: Следующий квартал — 0 P0 incidents. MTTR (Mean Time to Restore) снизился с 23 минут до 4 минут благодаря улучшенным runbooks.

---

**💬 Ключевая фраза**: *"На post-mortem я намеренно сказал: 'Система позволила этому случиться — нет staging parity, нет dep scan в CI.' Не 'инженер сделал ошибку'. Это изменило тон обсуждения с обвинения на решение проблемы."*

---

## 📊 Структура подготовки своих историй

| Тип вопроса | Нужная история | Ключевые метрики |
|-------------|---------------|-----------------|
| Performance | Оптимизация/incident | Latency до/после, CPU, RPS |
| Architecture | Design decision | Deploy time, failure rate, team size |
| Leadership | Disagreement/influence | # людей, срок, outcome |
| Crisis | Incident | MTTR, revenue impact, бизнес impact |
| Growth | Ошибка + урок | Что изменил, что внедрил |
