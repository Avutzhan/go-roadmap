# 🏗️ System Design Cases: Infrastructure & Coordination Systems

---

## 📌 Case 16: ZooKeeper / Coordination Service

### Для чего нужен
- **Leader Election**: какой node является primary
- **Distributed Config**: centralized key-value с watches
- **Service Discovery**: какие сервисы запущены и где
- **Distributed Locking**: межпроцессный mutex

### Архитектура (ZAB Protocol)

```
ZooKeeper Ensemble: нечётное число nodes (3, 5, 7)
→ Quorum: majority = (N/2 + 1) должны согласиться на write

Leader: принимает все write запросы
Followers: реплицируют данные от Leader
→ Write → Leader → broadcast Followers → ack от quorum → commit

Чтение: с любого node (eventual consistency)
Запись: всегда через Leader (strong consistency)
```

### Z-Node Tree

```
/
├── services/
│   ├── payment-service/
│   │   ├── instance-1  → {host: 10.0.1.5, port: 8080}
│   │   └── instance-2  → {host: 10.0.1.6, port: 8080}
│   └── auth-service/
│       └── instance-1  → {host: 10.0.2.1, port: 9090}
├── locks/
│   └── payment-lock    → ephemeral (удаляется при disconnect)
└── config/
    └── feature-flags   → {"dark_mode": true}
```

### Watches (Push vs Poll)

```
Без Watch: каждый клиент polling каждые N секунд → N×clients запросов
С Watch: клиент регистрирует Watch → ZK ПУШИТ только при изменении

zk.GetW("/config/feature-flags") → (data, _, watchCh)
go func() {
    <-watchCh  // блокируемся до изменения
    newData, _, _ := zk.Get("/config/feature-flags")
    // обновляем локальный кэш
}()
```

### Interview Answer
> "ZooKeeper: иерархический K-V store с consistency через Raft-подобный ZAB protocol. Ключевые фичи: ephemeral znodes (автоматически удаляются при disconnect клиента — идеально для leader election), watches (push notifications вместо polling). Leader election: все кандидаты создают ephemeral sequential node, наименьший номер = leader. etcd — современная альтернатива с нативным Go клиентом и HTTP/gRPC API."

---

## 📌 Case 17: Bigtable / Distributed Wide-Column Storage

### Структура данных

```
Bigtable = распределённая sparse sorted map:
(row_key, column_family:qualifier, timestamp) → value

Пример: хранение веб-страниц
row_key: "com.example.www"  (reversed domain для locality)
  column_family "content":
    "html"          @ T3 → "<html>..."
    "html"          @ T2 → "<html>... (older)"
  column_family "metadata":
    "crawl_date"    @ T3 → "2024-01-15"
    "page_rank"     @ T3 → "0.85"
```

### LSM Tree (Log-Structured Merge Tree)

```
Write path (оптимизировано для записи):
1. Write → WAL (Write-Ahead Log) на диск (crash recovery)
2. Write → MemTable (in-memory sorted structure)
3. MemTable заполняется → Flush на диск как SSTable (immutable)
4. Background: Compaction — merge SSTables, удаляем tombstones

Read path:
1. Check MemTable
2. Check Bloom Filter (есть ли key в каком-то SSTable?)
3. Если да → Check SSTables (новые → старые)

vs B-Tree:
B-Tree: random writes (update in-place) → много random I/O
LSM: sequential writes → append-only → HDD/SSD friendly
→ LSM write throughput 10× выше B-Tree для write-heavy workloads
→ LSM read немного медленнее (multi-level lookup)
```

### Tablet Architecture

```
Data split в Tablets (150MB каждый)
Tablets распределены по Tablet Servers

Master Server:
→ Отслеживает mapping: tablet → tablet_server
→ Load balancing: перемещает tablets между серверами
→ Fault detection

Tablet Server:
→ Обслуживает reads/writes для своих tablets
→ При overload → Master split tablet и redistribute

Hot Spot Prevention:
→ Row key design критичен!
→ Плохо: row_key = timestamp → все writes на один сервер (монотонно растёт)
→ Хорошо: row_key = hash + timestamp → distributed
```

### Interview Answer
> "Bigtable: wide-column store поверх LSM Tree. LSM оптимален для write-heavy (append → MemTable → SSTable), read с Bloom Filter для skip неактуальных SSTables. Row key design — критичен: reversed domain для locality, hash prefix для распределения горячих ключей. Compaction в фоне удаляет tombstones и merge SSTables. HBase — open-source аналог, Cassandra — без master (fully distributed)."

---

## 📌 Case 18: Code Deployment System (CI/CD)

### Pipeline Stages

```
Git Push → [CI/CD Pipeline]
  1. Source Checkout
  2. Build (Go binary / Docker image)
  3. Unit Tests + Race Detector
  4. Static Analysis (golangci-lint, SAST)
  5. Security Scan (govulncheck, Trivy для Docker)
  6. Push Artifact to Registry
  7. Deploy to Staging
  8. Integration Tests / Smoke Tests
  9. [Manual Gate если нужно]
  10. Deploy to Production (Canary → Full rollout)
```

### Deployment Strategies

```
Blue-Green:
→ Два идентичных окружения (Blue = current, Green = new)
→ Switch traffic: Load Balancer → Green
→ Blue остаётся как instant rollback
→ Минус: 2× инфраструктура

Canary:
→ 5% трафика → новая версия
→ Мониторинг: error rate, latency, business metrics
→ Если OK → 20% → 50% → 100%
→ Если плохо → 0% (rollback мгновенный)

Rolling Update (K8s default):
→ Обновляем pods по одному
→ Нет downtime, но есть момент когда работают обе версии
→ Проблема: API incompatibility между версиями

Feature Flags:
→ Код задеплоен, но фича выключена
→ Включаем для конкретных users/regions
→ A/B тестирование без деплоя
→ Инструменты: LaunchDarkly, Unleash
```

### Rollback Strategy

```
Artifact Versioning:
→ Docker image tagged: v1.2.3 (semver)
→ Предыдущий tag всегда доступен в registry

Health Check based auto-rollback:
→ K8s Liveness probe fails после deploy
→ Deployment controller → automatic rollback
→ Alert + PagerDuty notification

Manual rollback:
kubectl rollout undo deployment/payment-service
→ Переключается на предыдущий ReplicaSet мгновенно
```

### Interview Answer
> "CI/CD: GitHub Actions или ArgoCD (GitOps). Build artifact = Docker image, push в ECR/GCR с semver tag. Deploy via Helm + ArgoCD: Git = source of truth. Canary через Istio VirtualService (weight routing). Auto-rollback: если error rate > 1% за 5 минут после deploy → rollback через Argo Rollouts. Secrets: Vault + External Secrets Operator в K8s."

---

## 📌 Case 19: Online Multiplayer Game

### Архитектура

```
Client → Matchmaking Service → [создаём Game Instance]
              ↓
         Game Server (authoritative)
              ↑↓ UDP
         All Players (clients)

Game Loop (Server-side):
→ Tick Rate: 60 ticks/sec (каждые 16ms сбор inputs → compute state → broadcast)
→ Players send: {action: MOVE, direction: NORTH, timestamp: T}
→ Server applies → new game state
→ Server broadcasts state to all players
```

### Client-side Prediction & Lag Compensation

```
Проблема: 100ms latency → каждое нажатие кнопки выглядит как задержка 100ms

Client-side Prediction:
→ Клиент применяет движение НЕМЕДЛЕННО (не ждёт server ack)
→ Server подтверждает → если divergence → корректируем (interpolation)

Lag Compensation:
→ Когда игрок стреляет → он видит врага на old position
→ Server "перематывает" состояние назад на lag игрока → проверяет попадание
→ Fairness: с точки зрения shoot-er — попал
```

### State Management

```
Game State serialization:
→ Protobuf (compact, fast) для UDP пакетов
→ Delta compression: передаём только изменения (не весь state каждый тик)

Persistence:
→ In-memory во время игры (Redis для fast state)
→ PostgreSQL: результаты матчей, статистика, leaderboard

Pub/Sub для large rooms:
→ MMORPG: 1000 игроков в одной зоне
→ Spatial partitioning: каждый игрок получает state только от players в proximity
→ Сервер не broadcast всем — только "area of interest"
```

### Interview Answer
> "UDP для game state (потеря пакета лучше задержки — TCP retry = jitter). Game Server = authoritative, клиент локально предсказывает движение (client-side prediction), сервер корректирует при расхождении. Matchmaking: Elo-based skill matching + regional servers для low latency. Tick 60/s, delta compression для bandwidth. Для persistence: результаты в PostgreSQL, live state — если нужен — Redis."

---

## 📊 Infrastructure Systems Summary

| Система | Consistency | Protocol | Key Pattern |
|---------|------------|---------|------------|
| ZooKeeper/etcd | Strong (Raft) | ZAB/Raft | Watch + Ephemeral |
| Bigtable/Cassandra | Eventual/Tunable | Gossip | LSM Tree |
| CI/CD | N/A | GitOps | Canary + Rollback |
| Game Server | Authoritative | UDP | Client Prediction |
