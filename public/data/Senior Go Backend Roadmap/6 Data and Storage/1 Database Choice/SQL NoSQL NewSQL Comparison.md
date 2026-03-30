# 🧠 1. Database Selection: SQL, NoSQL, NewSQL

## 📌 Что это такое

Выбор базы данных — одно из важнейших (one-way door) решений в архитектуре. Staff-инженер умеет обосновать выбор через trade-offs, понимает внутреннее устройство разных СУБД и знает когда применять каждую.

---

## 🔬 Глубокий разбор (Senior/Staff)

### PostgreSQL: почему он выигрывает в 80% случаев

```sql
-- PostgreSQL не просто реляционная БД — это мультимодельная система

-- JSONB: документы с индексами (GIN) → замена многих MongoDB use cases
CREATE INDEX idx_user_metadata ON users USING GIN (metadata);
SELECT * FROM users WHERE metadata @> '{"premium": true}';

-- Arrays: нет JOIN для простых коллекций
ALTER TABLE products ADD COLUMN tags text[];
SELECT * FROM products WHERE 'electronics' = ANY(tags);
CREATE INDEX idx_tags ON products USING GIN (tags);

-- Full-text search: встроенный, без Elasticsearch для простых случаев
SELECT * FROM articles
WHERE to_tsvector('english', body) @@ to_tsquery('Go & concurrency');

-- Partitioning: для больших таблиц (logs, events)
CREATE TABLE events (
    id BIGINT,
    created_at TIMESTAMPTZ NOT NULL,
    data JSONB
) PARTITION BY RANGE (created_at);

CREATE TABLE events_2024_01 PARTITION OF events
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

### Когда NoSQL оправдан

```
MongoDB (Document):
✅ Часто меняющаяся схема в early stage
✅ Иерархические данные без JOIN
❌ Сложные транзакции (ACID только внутри документа до v4)
❌ Reporting с JOIN — становится мучением

Cassandra (Wide Column):
✅ Write-heavy: social media timeline, IoT metrics, logs
✅ Petabyte scale с linear horizontal scaling
✅ Multi-datacenter native replication
❌ Нет adhoc queries (только по partition key)
❌ Нет JOIN, ограниченные транзакции
Правило: design data model от queries, не от entities

Redis:
✅ Session storage (низкая latency, expire)
✅ Leaderboards (Sorted Sets)
✅ Pub/Sub, rate limiting
✅ Distributed locks
❌ Не замена основной БД (persistence ограничена)

ClickHouse (Columnar):
✅ OLAP: аналитика по миллиардам строк быстро (секунды)
✅ Real-time analytics dashboard
❌ OLTP: медленные точечные UPDATE/DELETE
```

### NewSQL: ACID + Horizontal Scale

```go
// CockroachDB / Spanner / TiDB — когда оба нужны одновременно

// Случай: финансовая система с глобальным трафиком
// PostgreSQL: отличная consistency, но vertical scale ограничен
// Cassandra: scale прекрасный, но eventual consistency неприемлема для денег
// CockroachDB: SQL интерфейс + ACID + geo-distributed + horizontal scale

// CockroachDB использует PostgreSQL -совместимый протокол!
db, err := sql.Open("pgx", "postgresql://root@cockroachdb:26257/bank?sslmode=disable")

// Geo-partitioning: пользовательские данные хранятся близко к пользователю
// CREATE TABLE users (...) PARTITION BY LIST (region);
// ALTER PARTITION europe OF TABLE users CONFIGURE ZONE USING constraints = '[+region=eu]';
```

### Storage Engines: внутри PostgreSQL и MySQL

```
PostgreSQL (Heap Storage):
- Таблица = heap файл с tuple'ами
- MVCC: каждая версия строки хранится отдельно (xmin, xmax)
- VACUUM: убирает dead tuples
- WAL (Write-Ahead Log): durability

MySQL/InnoDB (B+Tree clustered):
- Данные хранятся в B+Tree по PRIMARY KEY
- Все secondary indexes содержат PK → range scan по PK быстрее
- MVCC через undo log
- WAL = ib_logfile

LSM Tree (Cassandra, RocksDB, ClickHouse):
- Writes: только append в memtable → flush в SSTable
- Reads: merge нескольких SSTables + bloom filter
- Compaction: периодическое слияние SSTables
- Pros: супербыстрые writes
- Cons: read amplification, write amplification при compaction
```

---

## 🔥 Реальные боевые кейсы

- **PostgreSQL JSONB вместо MongoDB**: команда хотела Mongo для "гибкости". JSONB in Postgres + GIN index покрыл 95% их use cases. Осталась одна SQL БД, не две
- **Cassandra для event log**: 5 миллиардов событий/день. PostgreSQL захлебнулся на 100M. Cassandra с партиционированием по (user_id, bucket_day) — линейное масштабирование
- **ClickHouse для analytics**: аналитические запросы за месяц — 30 секунд в PostgreSQL, 0.3 секунды в ClickHouse
- **CockroachDB**: финтех с compliance требованием "данные EU не покидают EU" + ACID транзакции + horizontal scale

---

## 💬 Как отвечать на интервью

> "Для 80% проектов PostgreSQL — правильный выбор: он реляционный, ACID, имеет JSONB для документов, arrays, full-text search. Я расширяю его только при явных ограничениях: нужен глобальный horizontal scale с ACID — CockroachDB/Spanner, нужен write-heavy IoT/timeline — Cassandra/ScyllaDB, нужен аналитика по большим объёмам — ClickHouse. Главный вопрос: ваш workload OLTP или OLAP? Read-heavy или write-heavy? Нужна ли strong consistency или eventual OK?"

---

## ❓ Вопросы для интервью (Senior/Staff)

### Почему "Polyglot Persistence" — это не всегда благо?

Каждая дополнительная СУБД: операционный overhead (backup, monitoring, expertise), риск data inconsistency между системами (нужна синхронизация через CDC или API), cognitive load команды. Правило: добавляй новую СУБД только когда существующая явно не справляется, не из коробки.

### Как PostgreSQL реализует MVCC (Multiversion Concurrency Control)?

Каждая строка имеет `xmin` (TX создавшая) и `xmax` (TX удалившая). Транзакция видит snapshot данных на момент своего старта. Dead tuples (старые версии) не удаляются мгновенно — их чистит VACUUM. Поэтому частые UPDATE/DELETE создают bloat и нужен автовакуум. При долгих транзакциях — bloat растёт, что ведёт к full table scan вместо index scan.

### Как выбрать между Kafka и PostgreSQL queue для async задач?

PostgreSQL + SKIP LOCKED (queue pattern): проще операционно, атомарные транзакции с бизнес-данными, достаточно для < 10K messages/sec. Kafka: нужен replay, partitioned parallelism, fan-out (одно событие → много consumers), > 100K msg/sec. **Начни с PostgreSQL queue — можно мигрировать на Kafka, когда PostgreSQL станет узким местом.**

---

## 📊 Итоговая шпаргалка

| СУБД | Модель | Когда |
|------|--------|-------|
| PostgreSQL | RDBMS | Всё, что можно |
| MongoDB | Document | Flexible schema, иерархия |
| Cassandra | Wide Column | Write-heavy, petabyte scale |
| Redis | Key-Value | Cache, sessions, real-time |
| ClickHouse | Columnar | OLAP, analytics |
| CockroachDB | NewSQL | ACID + global horizontal scale |
| ElasticSearch | Search | Full-text search, log aggregation |
