# 🧠 2. Distributed Locking, Consensus & Service Mesh

## 📌 Что это такое

Advanced Infrastructure для Staff-инженера — это темы, которые выходят за рамки отдельного сервиса: как договориться между нодами (distributed locking, consensus), и как управлять коммуникацией в микросервисной среде (Service Mesh).

---

## 🔬 Distributed Locking: Redis vs Postgres vs etcd

### Redis Redlock — распределённый мьютекс

```go
// Проблема: несколько instance одного сервиса выполняют одну задачу одновременно
// Решение: Redis distributed lock

import "github.com/go-redis/redis/v9"

type DistributedLock struct {
    client    *redis.Client
    lockKey   string
    lockValue string // уникальный value для данного holder
    ttl       time.Duration
}

func (l *DistributedLock) Acquire(ctx context.Context) (bool, error) {
    // SET key value NX PX milliseconds — атомарно
    // NX: только если ключ не существует
    l.lockValue = uuid.New().String() // уникальный ID этого holder'а
    
    result, err := l.client.SetNX(ctx, l.lockKey, l.lockValue, l.ttl).Result()
    if err != nil {
        return false, fmt.Errorf("redis lock: %w", err)
    }
    return result, nil
}

func (l *DistributedLock) Release(ctx context.Context) error {
    // КРИТИЧНО: проверяем что value наш, потом удаляем — АТОМАРНО через Lua
    // Иначе: удалим lock другого holder'а если наш TTL истёк
    script := redis.NewScript(`
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
        else
            return 0
        end
    `)
    return script.Run(ctx, l.client, []string{l.lockKey}, l.lockValue).Err()
}

// Использование
func processCriticalSection(ctx context.Context, lock *DistributedLock) error {
    acquired, err := lock.Acquire(ctx)
    if err != nil {
        return err
    }
    if !acquired {
        return ErrLockNotAcquired // другой instance уже работает
    }
    defer lock.Release(ctx)
    
    // критическая секция
    return doWork(ctx)
}
```

**Проблема Redlock** (Martin Kleppmann critique): при split-brain или GC pause — два holder'а могут думать что держат lock одновременно. Для строгих требований → используй etcd (Raft consensus).

### etcd: distributed coordination на Raft

```go
import clientv3 "go.etcd.io/etcd/client/v3"
import "go.etcd.io/etcd/client/v3/concurrency"

func acquireETCDLock(client *clientv3.Client, key string) error {
    session, err := concurrency.NewSession(client, concurrency.WithTTL(30))
    if err != nil {
        return err
    }
    defer session.Close()
    
    mutex := concurrency.NewMutex(session, key)
    
    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()
    
    // Блокирующий lock — ждёт пока другой holder не освободит
    if err := mutex.Lock(ctx); err != nil {
        return fmt.Errorf("etcd lock: %w", err)
    }
    defer mutex.Unlock(context.Background())
    
    // Код под distributed lock
    return doWork()
}
// etcd использует Raft — консенсус гарантирует что только один держит lock
// даже при partial failures
```

### Service Mesh: Istio/Linkerd

```yaml
# Service Mesh добавляет sidecar proxy к каждому pod
# Весь трафик идёт через sidecar — приложение ничего не знает

# Istio VirtualService: traffic management без изменения кода
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: payment-service
spec:
  http:
  - match:
    - headers:
        x-user-group:
          exact: beta-testers
    route:
    - destination:
        host: payment-service
        subset: v2  # 100% beta-testerов → v2
  - route:
    - destination:
        host: payment-service
        subset: v1
        weight: 95  # 95% трафика → v1
    - destination:
        host: payment-service
        subset: v2
        weight: 5   # 5% → v2 (canary)
```

```yaml
# DestinationRule: retry, circuit breaker на mesh уровне
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: payment-service
spec:
  host: payment-service
  trafficPolicy:
    connectionPool:
      http:
        h2UpgradePolicy: UPGRADE
        http1MaxPendingRequests: 100
    outlierDetection:
      consecutive5xxErrors: 5     # 5 ошибок подряд
      interval: 30s               # за 30 секунд
      baseEjectionTime: 30s       # исключить на 30 секунд
      maxEjectionPercent: 50      # не исключать > 50% endpoints
  subsets:
  - name: v1
    labels:
      version: v1
  - name: v2
    labels:
      version: v2
```

---

## 🔥 Реальные боевые кейсы

- **Redis lock race**: две ноды обе подумали что lock свободен (после Redis restart) → двойная обработка платежа → решение: idempotency key в БД как дополнительная защита
- **etcd для leader election**: один из N воркеров должен быть "leader" (cron-like) → etcd сессии + mutex
- **Service Mesh mTLS**: убрали все hardcoded passwords для inter-service auth, заменили на SPIFFE identity через Istio
- **Canary через Istio**: 5% трафика → новая версия → автоматический rollback если error rate > 1%

---

## 💬 Как отвечать на интервью

> "Distributed locking — это серьёзная тема. Redis SetNX + Lua script для release — хорошо для большинства случаев, но имеет известные ограничения при split-brain. Для сильных гарантий — etcd (Raft consensus). Service Mesh как Istio решает cross-cutting concerns: mTLS, retries, circuit breaker, canary — без изменения кода приложения. Sidecar proxy перехватывает весь трафик. Это даёт полную обсервабильность и traffic management на уровне инфраструктуры."

---

## ❓ Вопросы для интервью (Senior/Staff)

### В чём главная критика алгоритма Redlock?

Martin Kleppmann доказал: если process A держит lock и попадает в GC pause дольше TTL → lock истекает → process B получает lock → A выходит из GC pause и продолжает работать. Оба считают себя owner. Решение: fencing token — монотонно растущий номер, который storage layer проверяет (только больший token принимается).

### Чем Service Mesh отличается от Library-based подхода (Hystrix в каждом сервисе)?

Library approach: каждый сервис сам реализует retry, circuit breaker, timeout. Проблемы: разные языки → разные реализации, обновление требует редеплоя всех сервисов. Service Mesh: единая реализация в sidecar proxy, обновляется независимо, работает для всех языков. Минус: операционная сложность, latency +2ms (два sidecar hop на запрос).

### Как реализовать leader election без etcd?

Вариант 1: Postgres Advisory Lock + heartbeat (если DB уже есть). Вариант 2: K8s Lease object (built-in механизм, используется самим Kubernetes). Вариант 3: Redis + Lua script с TTL refresh. Выбор зависит от: нужны ли строгие гарантии (etcd), есть ли Postgres (Advisory Lock), или хочется простоты (K8s Lease).

---

## 📊 Итоговая шпаргалка

| Инструмент | Гарантии | Когда |
|-----------|---------|-------|
| Redis SetNX | Eventual (риск split-brain) | Нет строгих требований |
| Redis + Redlock | Лучше, но не perfect | Distributed без etcd |
| etcd Mutex | Strong (Raft) | Leader election, критичные секции |
| Postgres Advisory Lock | Strong (ACID) | Если Postgres уже есть |
| K8s Lease | Strong | K8s-native leader election |
| Service Mesh (Istio) | N/A — traffic mgmt | mTLS, canary, circuit breaker |
