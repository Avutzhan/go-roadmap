# 🧠 2. Scale & Approach Traps at System Design

## 📌 Что это такое

Логические ловушки при system design интервью — когда инженер предлагает правильное решение, но в неправильном контексте масштаба или делает логические скачки которые рушат всё решение.

---

## 🔬 Ловушка 1: Premature Scaling — "Netflix Solution для стартапа"

```
❌ Типичный provider ошибки:
Вопрос: "Спроектируй сервис комментариев для вашего блога (1000 user/day)"

Ответ Senior A: 
"Нам нужен Kafka для event streaming, Redis Cluster для caching,
 Cassandra для write-heavy storage, k8s с autoscaling,
 GraphQL federation..."

❌ Проблемы:
1. Over-engineering: PostgreSQL + простой кэш решат задачу полностью
2. Команда 3 человека не унесёт такой стек операционно
3. Игнорирование ограничений (бюджет, команда, сроки)
4. Не спросил context!

✅ Staff-подход:
"Прежде всего несколько вопросов:
 - Сколько пользователей сейчас и ожидаемый рост?
 - Read-heavy или write-heavy?
 - Нужна ли real-time (WebSocket) или eventual OK?
 - Размер команды и бюджет?
 
 При 1000 user/day: PostgreSQL с B-Tree индексами на (post_id, created_at),
 Nginx для статики, Redis для top-N popular posts.
 Это решит задачу. Kafka понадобится при > 100K write/sec — обсудим когда дойдём."
```

### Ловушка 2: Игнорирование Failure Modes

```
Common mistake: описываем happy path, забываем о failures

❌ "Сервис A вызывает Сервис B, который пишет в БД"
   (Что если В недоступен? Что если БД таймаутнет?)

✅ Staff вопросы к себе при проектировании:
1. Что если этот компонент упадёт?
2. Что если сеть между A и B деградирует?
3. Что если запрос придёт дважды (retry)? Идемпотентен ли API?
4. Что если данные придут частично?
5. Как мы узнаем что что-то пошло не так? (observability)

Правило: каждая стрелка на диаграмме — это потенциальный failure point
```

### Ловушка 3: CAP без понимания бизнес-требований

```
❌ "Я выбираю Cassandra потому что она AP"
   (А требует ли система eventual consistency или нужна strong?)

Примеры правильной mapping:

Банковские переводы:
→ CP (Consistency): нельзя показать разные балансы двум клиентам
→ PostgreSQL с SERIALIZABLE isolation

Social media likes:
→ AP (Availability): лайков может быть "примерно 1K" — eventual OK
→ Cassandra с counter type

Inventory management:
→ Depends! Отображение количества товара: AP (approximate)
→ Резервирование товара при заказе: CP (нельзя продать одно двум)
→ CQRS: Cassandra для read, PostgreSQL для write
```

### Ловушка 4: Не думать о Data Consistency при Microservices

```
❌ Наивный подход:
"Сервис заказов вызывает сервис инвентаря и сервис платежей синхронно"

Проблемы:
- Partial failure: заказ создан, инвентарь уменьшен, платёж упал
  → Inconsistent state! Как откатить?
- Tight coupling: все три сервиса должны быть alive одновременно

✅ Staff подход — Saga Pattern:
  Option A: Choreography Saga (event-driven)
  OrderCreated event → Inventory.Reserve() → InventoryReserved event 
  → Payment.Charge() → PaymentFailed event → Inventory.Release()
  
  Option B: Orchestration Saga
  OrderOrchestrator управляет всеми шагами и compensating transactions

✅ Outbox Pattern для at-least-once delivery:
Записываем в Orders и events таблицу в ONE transaction
Background worker читает events и публикует в Kafka
```

### Ловушка 5: Single Point of Failure (SPOF)

```go
// Ловушка: архитектура выглядит distributed но имеет единую точку отказа

// ❌ One Load Balancer:
// All traffic → [Single LB] → [App Servers]
// Если LB упал → всё упало

// ✅ Redundant LBs с DNS failover или active-active:
// DNS → [LB1] → [App Pool 1]  ← Anycast / Active-Active
//      [LB2] → [App Pool 2]

// ❌ Single Master Database:
// Все writes → [Master DB]
// Master упал → writes невозможны до failover (5-30 минут)

// ✅ DB HA с automatic failover:
// Primary + Replica, Patroni/pg_auto_failover для PostgreSQL
// Failover < 30 секунд

// ❌ Single Kafka broker → ❌ Single ZooKeeper
// ✅ Kafka cluster: minimum 3 brokers, RF=3, min.insync.replicas=2
```

---

## 🔥 Золотой чеклист для System Design Interview

```markdown
1. CLARIFY (5 минут):
   □ Scale: DAU, RPS, data size?
   □ Latency requirements (p50, p99)?
   □ Consistency: strong или eventual OK?
   □ Read vs Write ratio?
   □ Geographic distribution?

2. BACK-OF-ENVELOPE calculation:
   □ QPS calculation
   □ Storage estimation
   □ Bandwidth requirements

3. HIGH-LEVEL design:
   □ Clients → API Gateway → Services
   □ Named каждый компонент с его ответственностью

4. DEEP DIVE в самые сложные/интересные части:
   □ Database schema + indices
   □ Caching strategy
   □ Consistency model

5. FAILURE MODES:
   □ Что если один сервис упадёт?
   □ Что если БД упадёт?
   □ Как мы это узнаем? (монитoring/alerting)
   □ Как мы восстановимся?

6. TRADE-OFFS:
   □ Что мы пожертвовали ради масштабируемости?
   □ Где у нас eventual consistency и почему это OK?
```

---

## 💬 Как отвечать на интервью

> "На system design я начинаю с clarification: scale, consistency requirements, read/write ratio. Это определяет всё. Потом back-of-envelope: если RPS < 10K — один PostgreSQL справится, начинать с Kafka это over-engineering. Обязательно проговариваю failure modes: каждая связь на диаграмме — потенциальный failure. Заканчиваю trade-offs: что мы потеряли, почему это приемлемо."

---

## ❓ Вопросы для интервью (Senior/Staff)

### Как посчитать RPS для системы?

```
DAU (Daily Active Users) × actions per user per day / 86400 seconds
= 1M DAU × 10 actions / 86400 ≈ 116 RPS average
Peak = average × 3-5x = ~500 RPS
```
Хранилище: write RPS × object size × retention. Bandwidth: RPS × response size.

### Когда Kafka overdone для системы?

Kafka overhead: complexity, ops, latency (минимум 5-10ms). Не нужна если: один consumer, нет replay requirement, трафик < 1000 events/sec, команда не имеет Kafka expertise. Alternatives: PostgreSQL LISTEN/NOTIFY, Redis Streams (simpler), RabbitMQ (если команда знает).

### Почему "Microservices с shared DB" — anti-pattern?

Если два сервиса шарят одну БД — они жёстко связаны: изменение схемы в одном сервисе ломает другой, нет независимого деплоя. Это "distributed monolith" — худший из двух миров. Правило: database per service. Данные шарятся через API или events, не через прямой DB access.

---

## 📊 Итоговая шпаргалка

| Ловушка | Симптом | Решение |
|---------|---------|---------|
| Premature scaling | Kafka для 100 users | Clarify scale first |
| Ignore failure modes | Нет circuit breaker, retry | Проговори каждую стрелку |
| CAP без business context | "Выберу AP" без понимания | Consistency requirement first |
| Partial failure в microservices | Inconsistent state | Saga pattern + Outbox |
| SPOF в "distributed" системе | Single LB, Single Master | Redundancy на каждом layer |
| Shared DB | "Distributed monolith" | Database per service |
