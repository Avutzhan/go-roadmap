# 🧠 3. Real-world Production Pitfalls in Go

## 📌 Что это такое

Ловушки которые реально встречаются в production Go-системах. Это не академические примеры — это паттерны которые стоили командам реальных инцидентов. Staff-инженер знает их и умеет pre-emptively задавать правильные вопросы на code review.

---

## 🔬 Ловушка 1: Goroutine Leak — тихий убийца памяти

```go
// ❌ Классическая утечка: горутина ждёт на канале, которого никто не закроет
func fetchData(url string) <-chan Result {
    ch := make(chan Result)
    go func() {
        result, err := http.Get(url)
        // Если caller перестал читать из ch — горутина зависнет НАВСЕГДА
        ch <- Result{result, err}
    }()
    return ch
}

// ❌ Утечка с context: context должен быть ВЕЗДЕ
func processItems(items []Item) {
    for _, item := range items {
        go func(i Item) {
            // Нет context — нет способа отменить эту горутину
            result, _ := http.Get(i.URL)
            _ = result
        }(item)
    }
    // При завершении processItems — горутины продолжают работать!
}

// ✅ Правильно: всегда передавай context, используй WaitGroup или errgroup
func processItems(ctx context.Context, items []Item) error {
    g, ctx := errgroup.WithContext(ctx)
    
    for _, item := range items {
        item := item
        g.Go(func() error {
            req, err := http.NewRequestWithContext(ctx, http.MethodGet, item.URL, nil)
            if err != nil {
                return err
            }
            resp, err := http.DefaultClient.Do(req)
            if err != nil {
                return err // контекст отменён — все горутины завершатся
            }
            defer resp.Body.Close()
            return nil
        })
    }
    return g.Wait()
}

// Поиск утечек: goroutine count через Prometheus или pprof
// GET /debug/pprof/goroutine?debug=2 — посмотреть стек каждой горутины
```

---

## 🔬 Ловушка 2: Time Zone в Database

```go
// ❌ Проблема: time.Time и PostgreSQL timezone mismatch
// time.Now() возвращает local time
// PostgreSQL может хранить в UTC или local — зависит от колонки

// ❌ TIMESTAMP WITHOUT TIME ZONE — теряет timezone info
// "2024-01-15 10:00:00" — это UTC? Local? Неизвестно!

// ✅ PostgreSQL TIMESTAMPTZ = TIMESTAMP WITH TIME ZONE
// Хранит UTC, возвращает с timezone

// ✅ Всегда работай с UTC в Go
func createEvent() *Event {
    return &Event{
        CreatedAt: time.Now().UTC(), // явно UTC!
    }
}

// ✅ При сканировании из DB — указывай location
db, _ := sql.Open("postgres", dsn+"&timezone=UTC")
// или pgx:
pgxConn.Config.RuntimeParams["timezone"] = "UTC"

// ❌ Опасный anti-pattern: арифметика дат без учёта DST
// Добавить "1 день" к datetime может дать 23 или 25 часов при DST переходе
nextDay := event.Time.Add(24 * time.Hour) // ❌ может быть неверно при DST
nextDay = event.Time.AddDate(0, 0, 1)     // ✅ правильно: calendar day
```

---

## 🔬 Ловушка 3: Defer в цикле — утечка ресурсов

```go
// ❌ defer в цикле — ресурсы не освобождаются до конца функции!
func processFiles(paths []string) error {
    for _, path := range paths {
        f, err := os.Open(path)
        if err != nil {
            return err
        }
        defer f.Close() // ❌ ВЫПОЛНИТСЯ ТОЛЬКО КОГДА processFiles ВЕРНЁТСЯ
        // Если paths = 10000 файлов → 10000 открытых файловых дескрипторов!
        process(f)
    }
    return nil
}

// ✅ Вынеси в отдельную функцию или используй closure
func processFiles(paths []string) error {
    for _, path := range paths {
        if err := processFile(path); err != nil {
            return err
        }
    }
    return nil
}

func processFile(path string) error {
    f, err := os.Open(path)
    if err != nil {
        return err
    }
    defer f.Close() // ✅ закроется при выходе из processFile
    return process(f)
}
```

---

## 🔬 Ловушка 4: Integer Overflow в бизнес-логике

```go
// ❌ Overflow при работе с деньгами (никогда int!!)
func calculateTotal(price, qty int32) int32 {
    return price * qty // overflow при price=200000 qty=20000: 200000*20000 > MaxInt32!
}

// ✅ Используй int64 или вынеси в cents (избегай float для денег!)
type Money struct {
    Amount   int64  // в центах
    Currency string
}

func (m Money) Add(other Money) (Money, error) {
    if m.Currency != other.Currency {
        return Money{}, ErrCurrencyMismatch
    }
    result := m.Amount + other.Amount
    if (other.Amount > 0 && result < m.Amount) ||
       (other.Amount < 0 && result > m.Amount) {
        return Money{}, ErrOverflow // явная проверка overflow!
    }
    return Money{Amount: result, Currency: m.Currency}, nil
}

// ❌ Float для денег — никогда!
// 0.1 + 0.2 = 0.30000000000000004 в IEEE 754
// Используй github.com/shopspring/decimal или работай в целых числах (cents)
```

---

## 🔬 Ловушка 5: HTTP Server — тихие таймауты и голодание

```go
// ❌ http.ListenAndServe без таймаутов — сервер без защиты
http.ListenAndServe(":8080", handler)

// ❌ Медленный клиент → горутина висит вечно, ест память
// "Slowloris" атака: кто-то медленно отправляет тело запроса → сервер ждёт вечно

// ✅ Правильная конфигурация production HTTP сервера
server := &http.Server{
    Addr:    ":8080",
    Handler: handler,
    
    // Время на чтение полного запроса (header + body)
    ReadTimeout: 10 * time.Second,
    
    // Время только на чтение header (до получения body)
    ReadHeaderTimeout: 2 * time.Second,
    
    // Время на отправку ответа
    WriteTimeout: 10 * time.Second,
    
    // Idle connection keep-alive timeout
    IdleTimeout: 120 * time.Second,
    
    // Максимальный размер header (защита от header injection DoS)
    MaxHeaderBytes: 1 << 20, // 1 MB
}

// Graceful shutdown — не убиваем активные соединения
quit := make(chan os.Signal, 1)
signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
<-quit

ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()
server.Shutdown(ctx) // ждёт завершения активных запросов
```

---

## 🔥 Реальные боевые кейсы

- **Goroutine leak**: сервис рекомендаций — 50K горутин за ночь, OOM в 6 утра. Причина: канал без context, никогда не закрывался
- **Timezone bug**: заказы создавались "вчерашние" у пользователей в UTC+12. Причина: `time.Now()` без UTC, PostgreSQL `TIMESTAMP WITHOUT TIME ZONE`
- **Defer в цикле**: batch-обработчик файлов — fd exhaustion после 1024 файлов. Сервис стал падать на ровном месте
- **Slowloris в production**: 200 соединений зависших клиентов выели весь connection pool. ReadTimeout спас 

---

## 💬 Как отвечать на интервью

> "Production Go имеет свои специфические ловушки. Горутинные утечки — всегда context + WaitGroup/errgroup, никаких 'просто go func'. Defer в цикле — принципиально никогда, это fd exhaust. Время — только UTC в коде, только TIMESTAMPTZ в Postgres. Деньги — только int64 в центах, никакого float. HTTP сервер — всегда явные таймауты, иначе Slowloris или просто 'зависший клиент убивает сервер'."

---

## ❓ Вопросы для интервью (Senior/Staff)

### Как обнаружить goroutine leak в production без перезапуска?

`runtime.NumGoroutine()` как Prometheus gauge — если монотонно растёт → утечка. Для детальной диагностики: HTTP endpoint `/debug/pprof/goroutine?debug=2` показывает стек каждой горутины (только в non-production или за auth). `go tool pprof` с профилем горутин — визуализация стеков.

### Почему не стоит использовать `panic` для error handling в сервисах?

В goroutine panic не перехватывается другими горутинами — если горутина паникует без `recover`, рантайм убивает весь процесс. В HTTP сервере `recover` в middleware спасает от падения handler'а. Но в фоновых worker горутинах — паника = смерть процесса. Правило: panic только для "невозможных" состояний (программная ошибка), не для expected errors.

### Что такое "escape to heap" и почему это важно в hot path?

Escape analysis компилятора решает где хранить переменную: stack или heap. Heap allocation нагружает GC. В hot path (millions rps) — каждая лишняя аллокация = GC pressure. Проверяем: `go build -gcflags="-m" ./...` видим что "escapes to heap". Решения: sync.Pool для reuse, value types вместо pointer types где возможно, pre-allocated буферы.

---

## 📊 Итоговая шпаргалка

| Ловушка | Симптом | Решение |
|---------|---------|---------|
| Goroutine leak | Память растёт, OOM | Context + errgroup, pprof/goroutine |
| Timezone bug | Неправильные timestamps | time.Now().UTC() + TIMESTAMPTZ |
| Defer в цикле | fd exhaustion | Вынеси в функцию |
| Float для денег | 0.1+0.2≠0.3 | int64 cents или decimal |
| HTTP без таймаутов | Slowloris, memory leak | ReadTimeout + WriteTimeout + Idle |
| Integer overflow | Неверные суммы | int64, explicit overflow check |
