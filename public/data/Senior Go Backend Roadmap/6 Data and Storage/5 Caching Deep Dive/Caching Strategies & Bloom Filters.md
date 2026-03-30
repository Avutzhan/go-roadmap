# 🧠 1. Redis Caching Strategies, Patterns & Bloom Filters

## 📌 Что это такое

Кэширование — не "добавить Redis" сверху, это **продуманная стратегия** с разными паттернами записи/чтения, инвалидации и защиты от пограничных случаев. Staff-инженер знает когда кэш помогает, а когда делает хуже.

---

## 🔬 Стратегии кэширования: Read Patterns

### Cache-Aside (Lazy Loading) — самый распространённый

```go
type ProductService struct {
    cache  *redis.Client
    db     *sql.DB
}

func (s *ProductService) GetProduct(ctx context.Context, id string) (*Product, error) {
    cacheKey := fmt.Sprintf("product:%s", id)
    
    // 1. Читаем из кэша
    cached, err := s.cache.Get(ctx, cacheKey).Bytes()
    if err == nil {
        var product Product
        if err := json.Unmarshal(cached, &product); err == nil {
            return &product, nil
        }
    }
    
    // 2. Cache miss — читаем из БД
    product, err := s.getFromDB(ctx, id)
    if err != nil {
        return nil, err
    }
    
    // 3. Пишем в кэш
    data, _ := json.Marshal(product)
    s.cache.Set(ctx, cacheKey, data, 15*time.Minute)
    
    return product, nil
}

// Плюсы: Read-heavy workloads, кэш только то что реально читается
// Минусы: первый запрос всегда медленный (cold start)
```

### Write-Through — синхронная запись в кэш + БД

```go
func (s *ProductService) UpdateProduct(ctx context.Context, p *Product) error {
    // 1. Записываем в БД
    if err := s.saveToDb(ctx, p); err != nil {
        return err
    }
    
    // 2. Обновляем кэш синхронно
    cacheKey := fmt.Sprintf("product:%s", p.ID)
    data, _ := json.Marshal(p)
    s.cache.Set(ctx, cacheKey, data, 15*time.Minute)
    
    return nil
}

// Плюсы: кэш всегда свеж, нет stale data
// Минусы: каждая запись = 2 операции, лишняя нагрузка при Write-heavy
```

### Write-Behind (Write-Back) — async запись в БД

```go
// Пишем в кэш немедленно, в БД — асинхронно через очередь
func (s *ProductService) UpdateProductAsync(ctx context.Context, p *Product) error {
    cacheKey := fmt.Sprintf("product:%s", p.ID)
    pendingKey := "pending_writes"
    
    pipe := s.cache.TxPipeline()
    data, _ := json.Marshal(p)
    pipe.Set(ctx, cacheKey, data, 15*time.Minute)
    pipe.LPush(ctx, pendingKey, p.ID) // очередь на запись в БД
    _, err := pipe.Exec(ctx)
    
    return err
    // Background worker читает pendingKey и пишет в БД
}

// Плюсы: максимальная write latency, batching в БД
// Минусы: риск потери данных при падении Redis до записи в БД
//         Нужен WAL или другой механизм надёжности
```

---

## 🔬 Cache Invalidation Strategies

### TTL + Event-driven invalidation

```go
// Гибридный подход: TTL как страховка + явная инвалидация

// При обновлении продукта:
func (s *ProductService) InvalidateProductCache(ctx context.Context, productID string) {
    keys := []string{
        fmt.Sprintf("product:%s", productID),
        fmt.Sprintf("product:category:%s", productID), // связанные ключи
        "products:list:page:*",                         // паттерн (используй SCAN, не KEYS!)
    }
    
    // KEYS команда блокирует Redis! Используй SCAN для паттернов
    var cursor uint64
    for {
        var keys []string
        var err error
        keys, cursor, err = s.cache.Scan(ctx, cursor, "products:list:*", 100).Result()
        if err != nil {
            break
        }
        if len(keys) > 0 {
            s.cache.Del(ctx, keys...)
        }
        if cursor == 0 {
            break
        }
    }
}
```

---

## 🔬 Защита от пограничных кейсов

### Cache Stampede (Thundering Herd)

```go
// Проблема: кэш истёк → 1000 запросов одновременно идут в БД

// Решение 1: Singleflight — только один запрос в БД
import "golang.org/x/sync/singleflight"

type CachedService struct {
    sf singleflight.Group
}

func (s *CachedService) GetProduct(ctx context.Context, id string) (*Product, error) {
    result, err, _ := s.sf.Do(id, func() (interface{}, error) {
        // Этот код выполнится ОДИН РАЗ для всех одновременных запросов с одним id
        return s.getFromDBAndCache(ctx, id)
    })
    if err != nil {
        return nil, err
    }
    return result.(*Product), nil
}

// Решение 2: Staggered TTL (jitter)
ttl := 15*time.Minute + time.Duration(rand.Intn(60))*time.Second
// Разные ключи истекают в разное время → нет одновременного stampede
```

### Cache Penetration — запрос на несуществующие ключи

```go
// Проблема: злоумышленник запрашивает ID которых нет → 
//           каждый раз бьём в БД (кэш не помогает)

// Решение 1: Кэшировать "null" значения
func (s *ProductService) GetProduct(ctx context.Context, id string) (*Product, error) {
    cached, err := s.cache.Get(ctx, "product:"+id).Bytes()
    if err == nil {
        if string(cached) == "null" {
            return nil, ErrNotFound // кэшированный "miss"
        }
        // ... unmarshal
    }
    
    product, err := s.getFromDB(ctx, id)
    if errors.Is(err, ErrNotFound) {
        s.cache.Set(ctx, "product:"+id, "null", 5*time.Minute) // кэшируем отсутствие
        return nil, ErrNotFound
    }
    // ...
}

// Решение 2: Bloom Filter
```

### Bloom Filter — компактная probabilistic структура

```go
import "github.com/bits-and-blooms/bloom/v3"

// Bloom filter: O(1) check "может быть в DB" vs "точно нет"
// False positive возможен (1%), false negative — невозможен

type ProductRepo struct {
    bloomFilter *bloom.BloomFilter
    db          *sql.DB
}

func NewProductRepo(db *sql.DB) *ProductRepo {
    // 1 million items, 1% false positive rate
    bf := bloom.NewWithEstimates(1_000_000, 0.01)
    
    // При старте загружаем все ID из БД в bloom filter
    rows, _ := db.Query("SELECT id FROM products")
    for rows.Next() {
        var id string
        rows.Scan(&id)
        bf.AddString(id)
    }
    
    return &ProductRepo{bloomFilter: bf, db: db}
}

func (r *ProductRepo) GetProduct(ctx context.Context, id string) (*Product, error) {
    // Bloom filter: если "точно нет" — не бьём в БД
    if !r.bloomFilter.TestString(id) {
        return nil, ErrNotFound // 100% уверенность в отсутствии
    }
    
    // Bloom says "maybe exists" — проверяем БД
    return r.getFromDB(ctx, id)
}
```

### Redis Pipelines и транзакции

```go
// Pipeline: отправляем несколько команд за один round-trip
pipe := rdb.Pipeline()
pipe.Set(ctx, "key1", "val1", 0)
pipe.Set(ctx, "key2", "val2", 0)
pipe.Get(ctx, "key1")
cmds, err := pipe.Exec(ctx)

// MULTI/EXEC транзакция — атомарность, нет блокировок
_, err = rdb.TxPipelined(ctx, func(pipe redis.Pipeliner) error {
    pipe.Decr(ctx, "stock:item:123")
    pipe.Incr(ctx, "sold:item:123")
    return nil
})
// ВАЖНО: Redis транзакции не rollback'ятся при ошибке выполнения команды
// Они только гарантируют что команды выполнятся последовательно, все вместе
```

---

## 🔥 Реальные боевые кейсы

- **Cache Stampede**: е-коммерс в Black Friday → 500K одновременных cache miss → DB упала. Решение: singleflight + staggered TTL
- **Cache Penetration атака**: ботнет запрашивал несуществующие product ID → Bloom Filter снизил DB нагрузку на 95%
- **Write-Behind потеря данных**: Redis перезапустился до flush в БД → 30 минут данных потеряно. Урок: Write-Through или AOF persistence
- **KEYS команда в Production**: KEYS `*` заблокировал Redis на 2 секунды в prod. Замена на SCAN исправила

---

## 💬 Как отвечать на интервью

> "Кэширование — это не просто Redis.Set(). Я выбираю стратегию под workload: Cache-Aside для read-heavy (кэшируем то что реально читается), Write-Through для read-after-write consistency, Write-Behind для write-heavy с риском потери данных. Ключевые защиты: singleflight против cache stampede, null-caching или Bloom Filter против cache penetration. Никогда не использую KEYS в production — только SCAN с курсором."

---

## ❓ Вопросы для интервью (Senior/Staff)

### Какие данные НЕ стоит кэшировать?

Данные с высокой write-frequency (счётчики реального времени — лучше Redis Counter, не кэш). Данные где stale = dangerous (balance, inventory — нужна strong consistency). Большие объекты, которые вытесняют другие из кэша (cold data). Персональные данные без необходимости (compliance риски).

### Как Redis обеспечивает атомарность через Lua скрипты?

Redis однопоточный — пока выполняется Lua скрипт, никакая другая команда не выполнится. Lua скрипт это атомарная операция без race conditions. Именно поэтому distributed lock release — через Lua: проверить и удалить без гонки.

### Чем Redis Cluster отличается от Redis Sentinel?

Redis Sentinel: HA для single master. Обнаруживает падение master → промоутит replica → обновляет клиентов. Нет sharding. Redis Cluster: автоматический sharding по 16384 hash slots. Каждый shard = master + replicas. Горизонтальное масштабирование. Кросс-slot транзакции ограничены ({hash tags}).

---

## 📊 Итоговая шпаргалка

| Стратегия | Latency | Freshness | Сложность |
|-----------|---------|-----------|-----------|
| Cache-Aside | Высокая (first hit) | Eventual | Низкая |
| Write-Through | Нормальная | Высокая | Средняя |
| Write-Behind | Низкая | Eventual | Высокая |
| **Проблема** | **Решение** | | |
| Cache Stampede | Singleflight + jitter TTL | | |
| Cache Penetration | null-cache или Bloom Filter | | |
| Stale data | TTL + event invalidation | | |
| Atomic ops | Lua scripts или MULTI/EXEC | | |
