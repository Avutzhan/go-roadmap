# 🧠 Advanced Migration Patterns, Anti-Abuse & Specialized System Design

## 📌 Что это такое

Продвинутые паттерны для специфических Senror/Staff сценариев: миграция сервисов с нулевым downtime, защита API от атак, геопространственные сервисы и real-time системы.

---

## 🔬 Zero Downtime Migration (e.g., Python → Go)

### Shadow Traffic / Dark Launch Pattern

```
Принцип:
1. Поднимаем новый Go-сервис параллельно со старым
2. Proxy дублирует каждый запрос на оба сервиса
3. Ответ пользователю — всегда от старого сервиса
4. Ответы сравниваются (Diffing) и расхождения логируются
5. Когда расхождений нет или они минимальны → переключаем трафик

[Client] → [Proxy] → [OLD Service] → ответ пользователю
                   ↘ [NEW Service] → ответ в сравнение/логи (игнорируется)
```

```go
// Простая реализация Shadow в Go middleware
func ShadowMiddleware(primary, shadow http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // Копируем тело запроса (оно может быть прочитано только раз)
        bodyBytes, _ := io.ReadAll(r.Body)
        r.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))

        // Запускаем shadow асинхронно, не блокируем основной запрос
        go func() {
            shadowReq := r.Clone(context.Background())
            shadowReq.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
            shadowRec := httptest.NewRecorder()
            shadow.ServeHTTP(shadowRec, shadowReq)
            // Логируем расхождения
            logDiff(shadowRec.Body.String(), shadowRec.Code)
        }()

        // Основной запрос идёт к primary
        primary.ServeHTTP(w, r)
    })
}
```

### CDC (Change Data Capture) при миграции БД

```
Проблема: нужно держать старую и новую БД в sync во время миграции

CDC (Debezium + Kafka):
1. Debezium читает PostgreSQL WAL (binlog)
2. Каждый INSERT/UPDATE/DELETE → событие в Kafka
3. Go consumer читает события → реплицирует в новую БД
4. Dual-write период: обе БД актуальны
5. Проверяем расхождения, мигрируем полностью

Инструменты: Debezium, GoReplay (HTTP traffic replay),
             Kafka Connect, custom Go consumer
```

---

## 🔬 Anti-Abuse & API Protection (Under Attack)

```
L7 Advanced Defence:

1. TLS Fingerprinting (JA3):
   - Каждый HTTP клиент имеет уникальный TLS fingerprint (порядок ciphers)
   - curl JA3 ≠ browser JA3 ≠ bot JA3
   - Cloudflare/nginx-lua: блокируем известные bot fingerprints

2. Identity-based Rate Limiting (лучше IP-based):
   - IP: легко обойти через proxy/VPN
   - API Key / User ID: rate limit на пользователя, а не на IP
   - Комбинация: IP + fingerprint + behavioral score

3. Dynamic Throttling:
   - Не блокируем сразу — замедляем
   - Suspicious session → delay response 500ms→1s→5s
   - Легитимный пользователь не заметит, бот оталась

4. Honeypot Endpoints:
   - Эндпоинты которые не видны в документации
   - Любой кто к ним обращается — или бот или attacker
   - Автоматический бан IP/fingerprint
```

```go
// Dead Man's Switch — алерт ЕСЛИ данные ПЕРЕСТАЛИ приходить
// Противоположность обычного алерта "если ошибок много"

func DeadMansSwitch(ctx context.Context, expectedInterval time.Duration) {
    ticker := time.NewTicker(expectedInterval * 2)
    defer ticker.Stop()
    
    for {
        select {
        case <-ticker.C:
            // Данные не приходили дольше 2*interval → алерт!
            alerting.Fire("DEAD_MANS_SWITCH", map[string]string{
                "message": "No data received in expected interval",
                "expected": expectedInterval.String(),
            })
        case <-lastDataReceived:
            ticker.Reset(expectedInterval * 2) // сброс при получении данных
        case <-ctx.Done():
            return
        }
    }
}
// Использование: мониторинг агентов, IoT устройств, cron-job heartbeat
```

---

## 🔬 Geospatial & Proximity Services

```
Задача: "Найди рестораны в радиусе 2км" (как Uber Eats, Yelp)

Наивное решение O(n): перебрать все рестораны, вычислить дистанцию
→ Для 1M ресторанов неприемлемо

Geohash подход:
- Делим карту мира на ячейки по уровням (1-12)
- Каждая ячейка → строка "u4pruydqqvj"
- Близкие точки имеют общий prefix!
- Поиск = найти все геохэши с одним prefix + 8 соседних ячеек

PostGIS (PostgreSQL extension):
CREATE EXTENSION postgis;
ALTER TABLE restaurants ADD COLUMN location GEOGRAPHY(POINT, 4326);
CREATE INDEX idx_location ON restaurants USING GIST(location);

SELECT name, ST_Distance(location, ST_MakePoint(37.6, 55.7)::geography) AS dist
FROM restaurants
WHERE ST_DWithin(location, ST_MakePoint(37.6, 55.7)::geography, 2000) -- 2km
ORDER BY dist LIMIT 20;
-- Index Only Scan по GIST → O(log n)

Quadtree (для in-memory):
- Рекурсивное деление 2D пространства на 4 квадранта
- Хранение объектов в leaves
- Поиск → O(log n)
```

---

## 🔬 CRDTs — для Collaborative Real-time Systems

```
Задача: Google Docs-like совместное редактирование

Проблема: два пользователя редактируют одновременно → conflict

OT (Operational Transformation):
- Transform операции друг относительно друга
- Сложная реализация (Google Docs, Etherpad)

CRDTs (Conflict-free Replicated Data Types):
- Математически гарантируют eventual consistency БЕЗ конфликтов
- Операции коммутативны и идемпотентны
- Примеры: G-Counter, LWW-Register, OR-Set, RGA (sequence)

Когда применять:
✅ Collaborative editing (notes, docs)
✅ Shopping cart (eventually consistent)
✅ Distributed counters, likes, presence
❌ Финансовые транзакции (нужна strict consistency)
```

---

## 🔬 Safe Database Migrations: Expand & Contract

```
Проблема: ALTER TABLE ADD COLUMN NOT NULL = table lock в PostgreSQL!

Expand & Contract Pattern:
Phase 1 (Expand):
  - ADD COLUMN nullable (нет lock!)
  - Backfill старые строки батчами
  - Код пишет в ОБА столбца (dual-write)

Phase 2 (Validate):
  - Убедиться что нет NULL в новом столбце
  - DROP NOT NULL аппликационный constraint (через DEFAULT)

Phase 3 (Contract):
  - Код читает только новый столбец
  - Удалить старый столбец (быстро, нет lock)

Аналогично для переименования столбца:
  - Нельзя RENAME под нагрузкой (блокировка)
  - Правильно: ADD new_column → dual-write → backfill → migrate reads → DROP old

Инструменты: golang-migrate, Atlas, pgroll
```

---

## 💬 Как отвечать на интервью

> "При миграции Python→Go использую Shadow Traffic: данные к обоим сервисам, но пользователю отвечает старый. Diffing показывает расхождения. CDC через Kafka/Debezium синхронизирует БД в переходный период. Для Anti-Abuse: identity-based rate limiting + fingerprinting лучше IP-блокировки. Для геосервисов: PostGIS + GIST индекс — Redis Geo работает для simpler случаев, PostGIS — для сложных запросов."

---

## ❓ Вопросы для интервью (Senior/Staff)

### Почему Dead Man's Switch критичен для мониторинга?

Обычный алерт: "если хорошее стало плохим". Dead Man's Switch: "если хорошее **перестало приходить**". Например: IoT датчик раньше посылал данные каждую минуту — теперь молчит 10 минут. Это тоже alert, даже если нет ошибок! Обрыв связи не генерирует ошибки.

### Чем Geohash лучше чем "просто рассчитать расстояние"?

Geohash позволяет использовать B-Tree индекс по строковому prefix. `WHERE geohash LIKE 'u4pru%'` → index scan. Расчёт `ST_Distance` для всех строк → sequential scan. При 10M точек разница: 50ms vs 30 секунд.

### Когда применять CRDT vs Event Sourcing?

CRDT: несколько участников редактируют одновременно, нет центрального сервера или высокая latency. Event Sourcing: нужна история изменений, audit trail, single source of truth. Google Docs = OT/CRDT. Financial ledger = Event Sourcing.
