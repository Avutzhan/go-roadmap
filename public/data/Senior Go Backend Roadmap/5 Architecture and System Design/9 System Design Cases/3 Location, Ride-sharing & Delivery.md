# 🏗️ System Design Cases: Location, Ride-sharing & Delivery

---

## 📌 Case 8: Uber / Lyft Ride-sharing

### Requirements
- Drivers send location every 4-5 seconds
- Match rider to nearest available driver (< 1s)
- Real-time tracking during trip
- Surge pricing based on supply/demand

### Location Update Pipeline

```
Driver App → Location Gateway → Kafka → Location Consumer
                                               ↓
                                    Driver Location Store (Redis)
                                    key: driver:{id} value: {lat, lng, timestamp}
                                    TTL: 30s (если нет обновлений → driver offline)

Scale: 1M active drivers × update/5s = 200K writes/sec
→ Redis Cluster: 200K ops/sec легко справляется
```

### Matching Engine (Spatial Index)

```
Problem: "Найди всех доступных водителей в радиусе 2km"

Решение 1: Geohash
→ Каждый driver → его Geohash (precision 6 = ~1km×1km cell)
→ При запросе: вычислить Geohash rider, взять его + 8 neighbors
→ Redis SMEMBERS geohash:{hash} → list of driver ids
→ Пересчитать точное расстояние для каждого

Решение 2: S2 Geometry (Google)
→ Сфера разделена на иерархические ячейки
→ Более точный чем Geohash (нет проблемы с границами)
→ Uber использует S2 в реальности

Алгоритм matching:
1. Найти кандидатов в радиусе (Geohash/S2)
2. Score = distance × ETA × driver acceptance rate
3. Выбрать лучшего driver
4. Notify driver (push notification)
5. Ожидать accept (timeout 10s → следующий кандидат)
```

### Surge Pricing

```
Supply/Demand ratio в каждой geo-cell:
surge_multiplier = f(active_requests / available_drivers)

Если ratio > 2.0 → surge 2x
Если ratio > 3.0 → surge 3x

Update: каждые 60 секунд по каждой ячейке города
Отображается на карте (heat map)
```

### Trip State Machine

```
SEARCHING → DRIVER_FOUND → DRIVER_EN_ROUTE → ARRIVED →
TRIP_IN_PROGRESS → COMPLETED / CANCELLED

Хранится в PostgreSQL (strong consistency — деньги!)
Каждый transition → event в Kafka (для billing, analytics)
```

### Interview Answer
> "Driver location→ Redis с TTL, Geohash для spatial lookup + 8 соседних ячеек. Matching: scored по ETA (через map service) + acceptance rate. Trip state machine в PostgreSQL с optimistic locking. Surge: demand/supply ratio per Geohash cell, пересчёт раз в минуту, храним в Redis."

---

## 📌 Case 9: DoorDash / Uber Eats (Three-sided Marketplace)

### Участники
- **Customer**: делает заказ
- **Restaurant**: готовит
- **Dasher (driver)**: доставляет

### Order Flow

```
Customer → Order Service → [DB: PENDING]
                        → Restaurant Notification (push/tablet app)
                        → Dispatcher starts dasher search

Restaurant accepts → [DB: CONFIRMED] → Estimated prep time updated

Dispatcher:
→ Найти ближайшего доступного Dasher (Geohash как Uber)
→ Учитывать: расстояние до ресторана + расстояние до клиента
→ Назначить Dasher → [DB: DASHER_ASSIGNED]

Dasher picks up → [DB: IN_DELIVERY]
Dasher delivers → [DB: DELIVERED] → Payment triggered
```

### Ключевые отличия от Uber
- **Batching**: одному Dasher могут назначить несколько заказов из рядом стоящих ресторанов
- **Prep time uncertainty**: ресторан может опаздывать → Dasher прибывает раньше (ждёт)
- **Динамическая зона доставки**: если нет Dasher в радиусе 5km — расширяем до 10km

### Real-time Tracking

```
Dasher app → Location update (WebSocket или HTTP polling fallback)
→ Location broadcast к Customer через WebSocket
→ Customer видит живую карту

Если Customer app в background → push notification "Dasher arrives in 2 min"
```

### Interview Answer
> "Трёхсторонний marketplace: Order Service с state machine (PENDING→CONFIRMED→ASSIGNED→DELIVERED). Dispatcher как Uber Matching Engine, но оптимизирует многоточечный маршрут (travelling salesman approximation для batching). Restaurant ETA + Dasher ETA = customer estimated delivery time. Payment в конце delivery → идемпотентная транзакция с idempotency key = order_id."

---

## 📌 Case 10: Google Maps / Navigation

### Компоненты

```
Map Data: тайлы (изображения) + граф дорог (nodes + edges)
Route API: кратчайший путь + ETA
Traffic: real-time обновление весов рёбер
Geocoding: адрес → координаты (и наоборот)
```

### Map Tiles

```
Мир разделён на tile grid (как шахматная доска, многоуровневый zoom)
Zoom 0: 1 тайл весь мир
Zoom 10: ~1M тайлов
Zoom 18: ~70B тайлов (уровень улицы)

Хранение: тайлы pre-rendered и хранятся в Object Store (GCS)
CDN: горячие тайлы кэшируются на Edge (популярные города)
Client: кэширует локально тайлы просмотренных областей
```

### Pathfinding

```
Naive Dijkstra: работает, но медленно на реальных картах (100M+ nodes)

Оптимизации:
1. Bidirectional Dijkstra: ищем с обоих концов → √N вместо N
2. A* (A-star): эвристика (прямое расстояние до цели) → меньше nodes расширяем
3. Hierarchical Graphs (CH - Contraction Hierarchies):
   → Pre-process: строим "shortcut" edges между важными узлами (хайвеи)
   → Query: сначала выходим на "highway level", потом спускаемся
   → 1000× быстрее чем Dijkstra для continental routes

Real-time Traffic:
→ Speed sensors, Waze crowdsource data, historical patterns
→ Обновляем edge weights каждые 5-15 минут
→ При изменении трафика → re-route предложение
```

### Interview Answer
> "Map tiles: pre-rendered по zoom levels, CDN для hot tiles, client-side local cache для offline. Routing: A* с Contraction Hierarchies для быстрого long-distance routing. Traffic: edge weights обновляются агрегацией GPS traces от пользователей (Kafka → MapReduce → Graph update). ETA: исторические данные + real-time speed × distance."

---

## 📊 Spatial Index Cheat Sheet

| Метод | Точность | Lookup | Используется |
|-------|---------|--------|-------------|
| Geohash | ~1km precision 6 | O(1) Redis | Uber, простые proximity |
| S2 Geometry | Переменная | O(log n) | Google Maps, Uber v2 |
| PostGIS (R-Tree) | Точная | O(log n) | Сложные geo queries |
| Quadtree | Адаптивная | O(log n) | Yelp, density-varying |
