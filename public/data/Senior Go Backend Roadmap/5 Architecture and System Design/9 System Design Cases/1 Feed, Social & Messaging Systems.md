# 🏗️ System Design Cases: Feed, Social & Messaging

---

## 📌 Case 1: Instagram / Facebook Newsfeed (Fan-out Problem)

### Requirements
- Users follow each other (social graph)
- See chronological or ranked feed of posts from people they follow
- Celebrity with 50M followers posts → must reach all followers

### High-Level Design

```
POST flow:
User → Post Service → Fanout Service → Redis Feed Cache (per user)
                    ↘ Media Store (S3)

READ flow:
User → Feed Service → Redis Feed Cache → return feed
```

### Fan-out Strategies

```
Fan-out on WRITE (Push model):
- При публикации → немедленно записываем пост во feed КАЖДОГО подписчика
- Плюс: чтение быстрое (pre-computed feed)
- Минус: запись дорогая для celebrities (50M writes!)

Fan-out on READ (Pull model):
- При чтении → собираем посты от всех кого читаешь
- Плюс: запись дешёвая
- Минус: чтение медленное (10K подписок = 10K lookups)

Hybrid (оптимальное решение):
- Regular users (< 10K followers) → Fan-out on WRITE
- Celebrities (> 10K followers) → Fan-out on READ
- При loading feed: Redis cache + live merge celebrity posts
```

### Key Components
- **Post Service**: создание постов, хранение в PostgreSQL
- **Fan-out Service**: async Kafka worker, пишет в Redis feed
- **Social Graph Service**: follower/following relationships (Redis Sets или graph DB)
- **Feed Cache**: Redis - `feed:{userId}` = ZSET(postId, timestamp)
- **Media Store**: S3 / CDN для изображений

### Trade-offs
- Redis feed per user: O(1) read, но память (100B users × 1KB = 100TB)
- Решение: хранить только последние 300 постов в cache, старые — из DB

### Interview Answer
> "Для celebrities применяю pull-at-read вместо fan-out-on-write — иначе один пост от Илона Маска вызывает 150M Redis write операций. Hybrid подход: порог 10K followers. Feed — ZSET в Redis с score=timestamp. Pagination через cursor (не offset — при вставке новых постов offset ломается)."

---

## 📌 Case 2: WhatsApp / Messenger

### Requirements
- 1-1 и групповые чаты
- Доставка сообщений: online → real-time, offline → push notification
- Статус: delivered / read receipts
- End-to-end encryption

### High-Level Design

```
Client A → [WebSocket Gateway] → [Message Service] → [Message DB (Cassandra)]
                                                    ↘ [Fanout to Client B's WebSocket]
                                                    ↘ [Push Notification (FCM/APNS)] если offline
```

### Ключевые решения

```
Transport: WebSocket (постоянное соединение) vs HTTP polling
→ WebSocket: сервер может push без запроса от клиента
→ MQTT: альтернатива для мобильных (меньше battery drain)

Message storage: Cassandra
→ Partition key: (chat_id) → все сообщения чата на одном узле
→ Clustering key: message_timestamp (сортировка по времени)
→ High write throughput, append-friendly

Offline delivery:
→ Message хранится в DB
→ При reconnect клиент запрашивает missed messages (pull)
→ Push notification через FCM/APNS для wake-up

E2E Encryption (Signal Protocol):
→ Сервер хранит encrypted blobs — не может читать сообщения
→ Key exchange при первом сообщении (X3DH protocol)
→ Double Ratchet для forward secrecy
```

### Presence Service (Online Status)

```
User connects → WebSocket Gateway → publishes to Presence Service
Presence Service → stores в Redis с TTL 30s (heartbeat сбрасывает TTL)
При disconnect или TTL expire → user = offline

Проблема: 1B users, 20% online = 200M entries
→ Не показывать точный статус всем — только друзьям
→ Lazy loading: запрашивать presence только когда открываешь чат
```

### Interview Answer
> "WebSocket на Gateway Service. При отправке сообщения: persist в Cassandra (partition by chat_id, cluster by timestamp) → fanout через internal queue → push к получателю через его WebSocket. Если offline — FCM. Delivery receipt = ACK от клиента обратно через WebSocket. Cassandra выбрана из-за high write throughput и append-only access паттерна."

---

## 📌 Case 3: Reddit / Quora (Voting & Feed Ranking)

### Requirements
- Posts, comments, upvotes/downvotes
- Ranking: hot posts вверху (динамически меняется)
- Subreddits / Topics
- Search

### Ranking Algorithm (Reddit "Hot")

```python
# Упрощённая модель Reddit ranking
score = log10(max(votes, 1)) + (created_at - epoch) / 45000
# Чем больше голосов И чем новее → выше score
# Через ~12 часов даже viral пост опускается → freshness важнее накопленных голосов
```

### Hot Feed Architecture

```
Naive: пересчитывать rank для всех постов при каждом голосе → O(n) too slow

Правильно:
1. Vote → increment counter в Redis (INCR key)
2. Background worker периодически (каждые 5 мин) пересчитывает rank
3. Ranked feed → Redis ZSET per subreddit (score = hot_score)
4. Read → ZRANGE subreddit:aww:hot 0 99 → top 100 posts

Pre-sorted ZSET: O(log n) insert, O(log n + k) range query
```

### Key Components
- **Vote Service**: idempotent (один user = один vote), Redis HyperLogLog для unique counts
- **Post Service**: PostgreSQL (structured), с JSONB для metadata
- **Search**: Elasticsearch (inverted index для full-text)
- **Comment Service**: nested comments → adjacency list или closure table в DB

### Interview Answer
> "Голосование — optimistic concurrency на PostgreSQL с atomic UPDATE votes = votes + 1. Hot score пересчитывается async воркером каждые 5 минут — не на каждый vote, иначе thundering herd. Результат в Redis ZSET per subreddit. Для search — Elasticsearch, индексируем title + body при публикации через Kafka event."

---

## 📊 Trade-offs Summary

| Система | Write strategy | Storage | Real-time |
|---------|---------------|---------|-----------|
| Instagram Feed | Hybrid fan-out | Redis ZSET + PostgreSQL | Async kafka |
| WhatsApp | Per-message | Cassandra (append) | WebSocket |
| Reddit Hot | Batch rerank | Redis ZSET + PostgreSQL | Near real-time (5 min) |
