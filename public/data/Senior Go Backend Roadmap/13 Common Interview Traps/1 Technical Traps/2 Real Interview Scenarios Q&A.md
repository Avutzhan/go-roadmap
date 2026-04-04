# 🧠 Real Interview Q&A: Senior Go Scenarios

## 📌 Что это такое

Реальные вопросы с Senior/Staff уровня Go интервью — открытые сценарии где проверяется глубина мышления, а не знание синтаксиса.

---

## ❓ Q1: Memory Leak в критическом сервисе под высокой нагрузкой

> *"Ваша команда обнаружила утечку памяти в критическом Go-сервисе во время пиковой нагрузки. Как вы найдёте причину и устраните?"*

**Системный подход:**

1. **Собрать данные без остановки сервиса:**
```bash
# Heap профиль на живом сервисе (нужен import _ "net/http/pprof")
curl http://prod-server:6060/debug/pprof/heap > heap.prof
go tool pprof heap.prof

# Goroutine dump — проверяем есть ли горутинные утечки
curl http://prod-server:6060/debug/pprof/goroutine?debug=2 > goroutines.txt
wc -l goroutines.txt  # если тысячи — утечка горутин
```

2. **Что искать в heap профиле:**
   - Top allocations: кто выделяет больше всего памяти?
   - Growing objects: буферы, слайсы, map'ы которые растут
   - Strings накапливаются в глобальных кэшах или map?

3. **Типичные causes:**
```go
// ❌ Goroutine leak: горутина ждёт на канале без context
go func() {
    result := <-unboundedChan // никогда не закроется
}()

// ❌ Map растёт без ограничений — типичная утечка кэша
var cache = make(map[string][]byte) // без eviction = утечка

// ❌ time.Ticker без Stop
ticker := time.NewTicker(time.Second)
// defer ticker.Stop() забыли!

// ❌ Ссылка на большой слайс через subset
func getFirst(data []byte) []byte {
    return data[:10] // backing array на весь data живёт!
}
// Fix: return append([]byte{}, data[:10]...)
```

4. **Верификация фикса:**
   - Воспроизвести в staging с нагрузочным тестом (`wrk`, `vegeta`)
   - Сравнить heap профили до и после
   - Мониторинг `go_memstats_alloc_bytes` в Prometheus

**Ответ на интервью:** *"Начинаю с данных: heap pprof + goroutine dump без рестарта сервиса. Ищу top allocators и rate of growth. Проверяю горутинный счётчик через `runtime.NumGoroutine()` в метриках — если монотонно растёт, утечка горутин. Фиксирую в staging, верифицирую benchmark'ами."*

---

## ❓ Q2: Random Crashes в Distributed Go Application

> *"Distributed Go-приложение падает случайно. Как диагностировать?"*

**Подход:**

1. **Собрать crash информацию:**
```bash
# Stack trace при панике — Go автоматически выводит в stderr
# Настрой logrotate + structured crash logs

# Race detector в staging
go run -race ./cmd/server

# Distributed trace через OpenTelemetry — где именно падает?
```

2. **Проверить concurrency issues:**
```go
// Проверяем race conditions: общие данные без синхронизации
// go test -race ./... — в CI обязательно!

// Deadlock detection: Go runtime выводит deadlock сам
// "all goroutines are asleep - deadlock!"
```

3. **Изолировать компоненту:**
   - Постепенно отключаем downstream вызовы
   - Проверяем: падает только при определённой нагрузке? При определённом запросе?
   - Сравниваем метрики до/после регрессии (когда начало падать?)

**Ответ:** *"Race detector + pprof goroutine dumps + distributed tracing. Изолирую компоненту через feature flags. Root cause — обычно либо race condition, либо panic в горутине без recover, либо resource exhaustion (FD или connection pool)."*

---

## ❓ Q3: Оптимизация для тысяч concurrent запросов

> *"Как оптимизировать Go-сервис для обработки тысяч concurrent запросов?"*

**Стратегии:**

```go
// 1. Goroutine pool — ограничиваем параллелизм
sem := make(chan struct{}, maxWorkers)
for _, item := range items {
    sem <- struct{}{}
    go func(i Item) {
        defer func() { <-sem }()
        process(i)
    }(item)
}

// 2. Connection pool tuning
db.SetMaxOpenConns(80)          // под нагрузку
db.SetMaxIdleConns(40)
db.SetConnMaxLifetime(5 * time.Minute)

// 3. HTTP Transport tuning
transport := &http.Transport{
    MaxIdleConns:        200,
    MaxIdleConnsPerHost: 50,
    IdleConnTimeout:     90 * time.Second,
    DisableKeepAlives:   false, // keep-alive критично!
}

// 4. sync.Pool для переиспользования объектов в hot path
var bufPool = sync.Pool{New: func() any { return &bytes.Buffer{} }}

// 5. Context + timeout: не висим вечно
ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
defer cancel()
```

**GC tuning:**
```bash
# GOGC=200 — сборщик мусора запускается реже (больше memory, меньше CPU)
# GOMEMLIMIT=2GiB — с Go 1.19: лимит памяти, GC запускается при приближении
export GOMEMLIMIT=2GiB
```

---

## ❓ Q4: Resilient интеграция с нестабильным внешним API

> *"Go-сервис интегрируется с внешним API которое часто недоступно. Как проектировать систему?"*

```go
// Circuit Breaker + Retry + Timeout — три слоя защиты

// Слой 1: Timeout
ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
defer cancel()

// Слой 2: Retry с exponential backoff
func callWithRetry(ctx context.Context, fn func() error) error {
    backoff := 100 * time.Millisecond
    for attempt := 0; attempt < 3; attempt++ {
        err := fn()
        if err == nil {
            return nil
        }
        if !isRetryable(err) { // 4xx — не retry, 5xx/timeout — retry
            return err
        }
        jitter := time.Duration(rand.Intn(int(backoff / 2)))
        select {
        case <-time.After(backoff + jitter):
            backoff *= 2
        case <-ctx.Done():
            return ctx.Err()
        }
    }
    return ErrMaxRetriesExceeded
}

// Слой 3: Circuit Breaker (используй github.com/sony/gobreaker)
cb := gobreaker.NewCircuitBreaker(gobreaker.Settings{
    MaxRequests: 5,
    Interval:    10 * time.Second,
    Timeout:     30 * time.Second, // half-open после 30s
    ReadyToTrip: func(counts gobreaker.Counts) bool {
        return counts.ConsecutiveFailures > 5
    },
})

// Fallback: кэшированные данные при недоступности API
func getProductWithFallback(ctx context.Context, id string) (*Product, error) {
    result, err := cb.Execute(func() (any, error) {
        return fetchFromAPI(ctx, id)
    })
    if err != nil {
        // Circuit open или ошибка → fallback к кэшу
        if cached, ok := cache.Get(id); ok {
            return cached, nil // stale but ok
        }
        return nil, err
    }
    return result.(*Product), nil
}
```

---

## ❓ Q5: Рефакторинг Legacy Go-системы

> *"Legacy Go-система требует рефакторинга для поддерживаемости и масштабируемости. Что делаешь?"*

**Последовательность:**

1. **Audit:** `golangci-lint`, `go vet`, `govulncheck`, dependency graph (`go mod graph`)
2. **Покрытие тестами ПЕРЕД рефакторингом** — нельзя рефакторить без safety net
3. **Strangler Fig:** новые фичи — в новой архитектуре, старые — постепенно мигрируем
4. **Interface-driven design:** зависимости через интерфейсы → легче тестировать и менять
5. **Separation of concerns:** Domain / UseCase / Infrastructure разделить явно

---

## ❓ Q6: Security Vulnerabilities после аудита

> *"Go-приложение имеет security уязвимости после аудита. Как приоритизировать?"*

**Приоритизация по CVSS + exploitability:**

1. **Critical/High + exploitable**: патчим НЕМЕДЛЕННО (RCE, auth bypass, data exposure)
2. **High + сложно эксплуатировать**: следующий sprint
3. **Medium**: в backlog с отслеживанием

```bash
# Автоматическая проверка CVE в зависимостях
govulncheck ./...

# OWASP Go specific:
# SQL Injection → параметризованные запросы (уже разобрано)
# Hardcoded secrets → detect через trufflehog/gitleaks в CI
# Insecure random → crypto/rand вместо math/rand для токенов
import "crypto/rand"
token := make([]byte, 32)
rand.Read(token) // криптографически безопасный
```

---

## 📊 Паттерн ответа на открытые scenario вопросы

```
1. Clarify (30 сек): "Уточню — это prod или staging? Есть ли observability?"
2. Systematic approach: начни с данных, не с предположений
3. Tools: конкретные инструменты (pprof, race detector, OpenTelemetry)
4. Trade-offs: упомяни что у решения есть цена (overhead профилирования в prod)
5. Result: как верифицируешь что проблема решена
```
