# 🧠 1. Trade-offs & Architectural Decision Making

## 📌 Что это такое

Staff-инженер не просто принимает решения — он **структурирует мышление** при принятии решений в условиях неопределённости, явно артикулирует trade-offs и строит консенсус в команде/организации.

---

## 🔬 Глубокий разбор (Senior/Staff)

### Trade-off Matrix: как структурировать сравнение

```markdown
## Выбор message broker для Order System

| Критерий            | Weight | Kafka | RabbitMQ | SQS | DB Polling |
|---------------------|--------|-------|----------|-----|------------|
| Throughput           | 30%    | 10    | 7        | 8   | 4          |
| Ordering guarantee  | 20%    | 10    | 7        | 6   | 10         |
| Operational overhead| 20%    | 4     | 7        | 9   | 10         |
| Replay capability   | 15%    | 10    | 3        | 4   | 8          |
| Team familiarity    | 15%    | 6     | 8        | 7   | 10         |
|---------------------|--------|-------|----------|-----|------------|
| **Weighted Score**  |        | **8.0**|**6.6** |**7.1**|**8.1**  |

Вывод: DB Polling выигрывает по числам, НО при росте > 5000 rps потребует рефакторинга.
Kafka — инвестиция в future scaling. Принимаем Kafka с пониманием операционного overhead.
```

**Важно**: Trade-off matrix не принимает решение автоматически. Она **структурирует разговор** и документирует что было рассмотрено.

### Архитектурные принципы принятия решений

```go
// 1. Reversibility: насколько дорого изменить решение?
//    One-way door: выбор БД, язык → долгое обсуждение
//    Two-way door: выбор логгера, HTTP клиента → быстрое решение

// 2. Blast Radius: если это упадёт, что пострадает?
//    Database shared by 10 services → huge blast radius
//    Database per service → isolated blast radius

// 3. Operability: можем ли мы это поддерживать?
//    Kafka: нужна экспертиза, dedicated ops
//    SQS: fully managed, меньше expertise ratio

// 4. Evolvability: можем ли развивать без полного переписывания?
//    Modular monolith → можно мигрировать части в microservices
//    Distributed monolith → worst of both worlds
```

### CAP & PACELC в реальных trade-offs

```
При NETWORK PARTITION вы выбираете:
CP (Consistency + Partition tolerance):
  - Kafka, HBase, ZooKeeper, etcd
  - Откажет часть запросов, но данные консистентны

AP (Availability + Partition tolerance):
  - Cassandra, DynamoDB, CouchDB
  - Всегда отвечает, но может вернуть stale данные

CA (Consistency + Availability):
  - Только в single node системах (нет partition tolerance)
  - Традиционный Postgres без репликации (в single node)

PACELC добавляет: даже без partition, есть trade-off между Latency и Consistency
```

### Strangler Fig Pattern: безопасная миграция

```
Монолит → Микросервисы без "big bang" переписывания

               [API Gateway / Proxy]
                /                  \
    [New Microservice]        [Legacy Monolith]
    (Orders v2 - Go)          (Orders v1 - PHP)

Шаги:
1. Поставить Proxy перед монолитом
2. Создать новый сервис для одного домена (Orders)
3. Постепенно переключать % трафика (1% → 10% → 50% → 100%)
4. Синхронизировать данные в переходный период (CDC или dual-write)
5. Убрать старый код из монолита

Ключевое: монолит и новый сервис работают ПАРАЛЛЕЛЬНО
никакой заморозки фичей на время переписывания
```

### Event Sourcing vs CRUD: когда что выбирать

```go
// CRUD: текущее состояние
type Order struct {
    ID     string
    Status string // только текущий статус
    Total  float64
}

// Event Sourcing: история событий = состояние
type OrderEvent interface {
    isOrderEvent()
}
type OrderCreated struct { OrderID string; Total float64 }
type OrderPaid    struct { OrderID string; PaidAt time.Time }
type OrderShipped struct { OrderID string; TrackingID string }

// Состояние = replay событий
func (o *Order) Apply(events []OrderEvent) {
    for _, e := range events {
        switch ev := e.(type) {
        case OrderCreated:
            o.ID = ev.OrderID
            o.Status = "created"
        case OrderPaid:
            o.Status = "paid"
        case OrderShipped:
            o.Status = "shipped"
        }
    }
}

// Когда Event Sourcing оправдан:
// ✅ Нужна полная история (аудит, финансы, compliance)
// ✅ Temporal queries: "каков был статус заказа 3 дня назад?"
// ✅ Event replay для новых read models (CQRS)
// ❌ НЕ нужен для CRUD-доменов без требований к истории
```

---

## 🔥 Реальные боевые кейсы

- **PostgreSQL vs MongoDB**: команда хотела MongoDB "для гибкости" → trade-off matrix показала что JSONB в Postgres даёт 90% гибкости с ACID → выбрали Postgres
- **Strangler Fig в Production**: payment-service мигрировали из монолита за 4 месяца, без downtime, используя dual-write + Kafka CDC
- **Event Sourcing регрет**: внедрили для "всего" → оказалось слишком сложно для простых CRUD доменов → ограничили только финансовым модулем

---

## 💬 Как отвечать на интервью

> "Принимая архитектурное решение, я сначала определяю: это one-way door или two-way door? Одноразовые решения требуют глубокого анализа. Для структурирования использую trade-off matrix — не чтобы получить ответ числами, а чтобы сделать сравнение явным и запротоколировать альтернативы. При выборе хранилища всегда думаю о blast radius (что упадёт если это ляжет) и reversibility (как дорого передумать через год)."

---

## ❓ Вопросы для интервью (Senior/Staff)

### Как справиться с "архитектурным комитетом", который блокирует решения?

Архитектурные комитеты часто становятся bottleneck. Решение: ADR-driven process — любая команда может принять решение, написав ADR и открыв period для комментариев. Только решения с высоким blast radius (shared databases, public API contracts) требуют формального review. Это распределяет власть без потери quality control.

### Когда микросервисы хуже монолита?

Когда: команда < 10 human, нет DevOps-экспертизы, нет четких domain boundaries, нет distributed tracing. Микросервисы добавляют: network latency, distributed transactions, observability complexity. Если domainы чётко не определены — получишь "distributed monolith" (все зависят от всех, плюс сеть).

### Как оценить technical debt и обосновать его устранение?

Техдолг = будущая выплата процентов. Метрики: lead time (сколько дней от commit до prod), change failure rate, time to onboard new engineer. Бизнес-язык: "наш change failure rate 30% — значит каждый 3й деплой требует rollback, это X часов инженеров в месяц. Рефакторинг окупится за Y месяцев."

---

## 📊 Итоговая шпаргалка

| Концепция | Когда применять |
|-----------|----------------|
| Trade-off Matrix | Любое нетривиальное техническое решение |
| One-way door | Выбор БД, языка, core архитектуры → долго |
| Two-way door | Библиотека, формат конфига → быстро |
| Strangler Fig | Миграция из монолита без big bang |
| Event Sourcing | Финансы, аудит, temporal queries |
| CRUD | Всё остальное — проще и дешевле |
| CAP-CP | Консистентность важнее доступности |
| CAP-AP | Доступность важнее (eventual consistency) |
