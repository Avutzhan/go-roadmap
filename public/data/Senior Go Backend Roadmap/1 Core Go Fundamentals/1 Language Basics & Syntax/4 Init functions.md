# 🧠 4. Init Functions

## 📌 Что это такое

`init()` — специальная функция в Go, которая вызывается **автоматически** при инициализации пакета, до `main()`. Её нельзя вызвать вручную — она вызывается только рантаймом.

```go
func init() {
    // выполнится до main()
    db = mustConnect()
}
```

---

## 🔬 Глубокий разбор (Senior/Staff)

### Порядок инициализации в Go (строго детерминирован)

```
1. Инициализация переменных пакета (package-level vars)
2. init() функции пакета (в порядке объявления)
3. init() импортированных пакетов (рекурсивно, сначала зависимости)
4. main()
```

```go
package main

import "fmt"

var x = compute() // 1. сначала это

func compute() int {
    fmt.Println("compute called") // печатается первым
    return 42
}

func init() {
    fmt.Println("init called, x =", x) // x уже = 42
}

func main() {
    fmt.Println("main called")
}
// Вывод:
// compute called
// init called, x = 42
// main called
```

### Несколько `init()` в одном файле и пакете

```go
// file: setup.go
func init() { fmt.Println("init 1") } // допустимо
func init() { fmt.Println("init 2") } // тоже допустимо, выполнится после

// В одном пакете из нескольких файлов — порядок файлов определяется компилятором
// (обычно алфавитный), но на это НЕЛЬЗЯ РАССЧИТЫВАТЬ
```

### Импорт только ради side-effects: `_`

```go
import (
    "database/sql"
    _ "github.com/lib/pq" // только для init(): регистрирует postgres driver
)
```

Это стандартный паттерн для:
- Регистрации database drivers (`database/sql`)
- Регистрации image decoders (`image/png`, `image/jpeg`)
- Регистрации prometheus collectors
- Plugin-систем (регистрация обработчиков)

### ❗ Антипаттерн: скрытые зависимости через init()

```go
// ❌ Плохо: init() создаёт глобальное состояние — невидимый side-effect
var globalPool *redis.Pool

func init() {
    globalPool = redis.NewPool(...) // ошибку потеряли
}

// ✅ Лучше: явная инициализация с обработкой ошибок
func NewRedisPool(cfg Config) (*redis.Pool, error) {
    pool := redis.NewPool(...)
    if err := pool.Ping(); err != nil {
        return nil, fmt.Errorf("redis ping failed: %w", err)
    }
    return pool, nil
}
```

**Правило**: `init()` **не может вернуть ошибку**. Любая ошибка в `init()` должна вызывать `panic` или `log.Fatal` — это делает диагностику сложной. Предпочитай явную инициализацию через конструкторы.

### Circular imports и init()

Если пакет A импортирует пакет B, а B импортирует A — это **compile-time error**. Go запрещает circular imports. `init()` здесь не помогает.

---

## 🔥 Реальные боевые кейсы

- **`database/sql` drivers**: `_ "github.com/lib/pq"` — postgres driver регистрируется через `init()` в `sql.Register()`
- **`image` decoders**: `_ "image/png"` для поддержки PNG-формата
- **Prometheus**: регистрация custom collectors через `prometheus.MustRegister()` в `init()`
- **Feature flags**: pre-loading конфигурации из env variables в `init()`

---

## 💬 Как отвечать на интервью

> "init() — это hook рантайма для инициализации пакета. Порядок строго определён: сначала package-level vars, потом init() импортов (глубина в первую очередь), потом init() текущего пакета, потом main(). Я использую init() только для side-effect импортов (drivers, plugins). Для реальной инициализации предпочитаю явные конструкторы, которые могут вернуть ошибку — init() не может, и любая паника там сложно диагностируется."

---

## ❓ Вопросы для интервью (Senior/Staff)

### Можно ли тестировать код с `init()` и как это влияет на тесты?

`init()` выполняется при каждом импорте пакета, включая тесты. Если `init()` делает I/O (подключение к БД, чтение файлов) — тесты будут зависеть от окружения. Решение: вынести I/O из `init()` в явные функции, которые тест может инициализировать сам или замокать.

### Как гарантировать, что driver зарегистрирован единожды?

`database/sql.Register()` использует `sync.Once` + mutex внутри. Если вызвать Register дважды с одним именем — паника. Blank import `_` гарантирует, что `init()` вызовется ровно один раз даже если пакет импортирован из нескольких мест (компилятор дедуплицирует импорты).

### В каком порядке вызываются `init()` при diamond-зависимостях?

```
A → B, C
B → D
C → D
```
`D.init()` вызовется **один раз** (Go дедуплицирует). Потом `B.init()`, `C.init()`, `A.init()`. Порядок между B и C — в зависимости от порядка импортов в A.

---

## 📊 Итоговая шпаргалка

| Аспект | Детали |
|--------|--------|
| Вызов | Автоматически, нельзя вызвать вручную |
| Ошибки | Не может вернуть — только panic/log.Fatal |
| Количество | Несколько в одном файле/пакете — допустимо |
| Порядок | Package vars → imports init → текущий init |
| Best use | Blank imports (`_`) для driver/plugin regexp |
| Anti-pattern | Скрытая I/O инициализация с потерей ошибок |