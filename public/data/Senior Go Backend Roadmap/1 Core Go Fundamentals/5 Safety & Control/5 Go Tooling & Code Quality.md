# 🧠 Go Tooling: vet, doc, coverage, benchmarks & static analysis

## 📌 Что это такое

Go имеет богатый встроенный toolchain. Senior инженер использует эти инструменты ежедневно и настраивает их в CI. Это часто спрашивают на интервью.

---

## 🔬 go vet — статический анализ

```bash
# go vet обнаруживает подозрительные конструкции которые компилятор пропускает
go vet ./...

# Что находит go vet:
# - printf format mismatch: fmt.Printf("%d", "string") 
# - unreachable code после return/panic
# - incorrect mutex copy: sync.Mutex не должен копироваться
# - shadowed variables в некоторых случаях
# - structtag ошибки: json:"name,omitempty" vs json:"name, omitempty"
```

```go
// Пример что поймает go vet:
var mu sync.Mutex
mu2 := mu // ❌ vet: locks should not be copied!

fmt.Printf("%d", "hello") // ❌ vet: format %d has arg "hello" of wrong type

// struct tag ошибка:
type User struct {
    Name string `json: "name"` // ❌ vet: пробел после двоеточия!
    Age  int    `json:"age"`   // ✅
}
```

### golangci-lint — meta-linter для CI

```yaml
# .golangci.yml
linters:
  enable:
    - govet        # go vet
    - errcheck     # проверяет что ошибки обработаны
    - staticcheck  # продвинутый статический анализ
    - gosimple     # упрощение кода
    - unused       # неиспользуемый код
    - gocyclo      # цикломатическая сложность
    - misspell     # опечатки в комментах
    - gosec        # security issues (SQL injection, hardcoded creds)
    - revive       # замена golint

linters-settings:
  gocyclo:
    min-complexity: 15  # функции сложнее 15 → предупреждение
```

```bash
# В CI:
golangci-lint run --timeout=5m ./...
```

---

## 🔬 go doc — документирование кода

```go
// Go doc генерируется из комментариев перед объявлениями
// Формат: комментарий начинается с имени символа

// Package payment provides interfaces for processing payments.
// It supports multiple payment providers through a pluggable interface.
package payment

// ErrInvalidAmount is returned when payment amount is zero or negative.
var ErrInvalidAmount = errors.New("invalid amount")

// Processor defines the interface for payment processing.
// Implementations must be safe for concurrent use.
type Processor interface {
    // Charge attempts to charge the given amount in cents.
    // Returns ErrInvalidAmount if amount <= 0.
    Charge(ctx context.Context, amount int64, currency string) (*Receipt, error)
}

// NewStripeProcessor creates a new Stripe payment processor.
// apiKey must be a valid Stripe secret key (starts with "sk_").
func NewStripeProcessor(apiKey string) *StripeProcessor { ... }
```

```bash
go doc payment.Processor       # документация на интерфейс
go doc payment.Processor.Charge # документация на метод
godoc -http=:6060              # локальный web сервер с doc
```

---

## 🔬 Code Coverage

```bash
# Запуск тестов с покрытием
go test -coverprofile=coverage.out ./...

# Просмотр в терминале
go tool cover -func=coverage.out

# Визуальный HTML отчёт (открыть в браузере)
go tool cover -html=coverage.out -o coverage.html

# Только процент покрытия
go test -cover ./...
# output: coverage: 78.5% of statements
```

```go
// Что значат цифры:
// Statement coverage: % исполненных statements
// НЕ означает что все edge cases проверены!

// Пример: функция с 90% coverage может иметь непокрытый error path
func divide(a, b float64) (float64, error) {
    if b == 0 {         // ← если НЕ тестируем b==0, этот branch не покрыт
        return 0, ErrDivisionByZero
    }
    return a / b, nil  // ← если этот путь тестируем, coverage растёт
}
```

**В CI:** стандартно ставится threshold `go test -coverprofile=coverage.out && go tool cover -func=coverage.out | grep total | awk '{print $3}' | awk -F'%' '{if ($1 < 80) exit 1}'`

---

## 🔬 Benchmarking — доказательная оптимизация

```go
// Benchmark функция: начинается с Benchmark, принимает *testing.B
func BenchmarkJSONMarshal(b *testing.B) {
    user := User{Name: "Alice", Age: 30}
    b.ReportAllocs() // показать аллокации
    b.ResetTimer()   // сбросить таймер после setup
    
    for i := 0; i < b.N; i++ {
        _, _ = json.Marshal(user)
    }
}

// Sub-benchmarks для сравнения
func BenchmarkEncoders(b *testing.B) {
    data := User{Name: "Alice", Age: 30}
    
    b.Run("encoding/json", func(b *testing.B) {
        for i := 0; i < b.N; i++ {
            json.Marshal(data)
        }
    })
    b.Run("go-json", func(b *testing.B) {
        for i := 0; i < b.N; i++ {
            gojson.Marshal(data)
        }
    })
}
```

```bash
# Запуск benchmarks
go test -bench=BenchmarkJSONMarshal -benchmem -count=5 ./...

# Вывод:
# BenchmarkJSONMarshal-8   2000000   743 ns/op   208 B/op   4 allocs/op
#                          ^N        ^time/op      ^memory   ^allocs

# Сравнение двух версий через benchstat
go test -bench=. -benchmem -count=10 ./... > before.txt
# (меняем код)
go test -bench=. -benchmem -count=10 ./... > after.txt
benchstat before.txt after.txt
# Покажет статистически значимое изменение
```

---

## 🔬 Stringer Interface

```go
// fmt.Stringer: если тип реализует String() string — fmt использует его
type Status int

const (
    StatusPending Status = iota
    StatusActive
    StatusClosed
)

// Ручная реализация:
func (s Status) String() string {
    switch s {
    case StatusPending: return "pending"
    case StatusActive:  return "active"
    case StatusClosed:  return "closed"
    default:            return fmt.Sprintf("Status(%d)", int(s))
    }
}

// Автогенерация через go generate + stringer tool:
//go:generate stringer -type=Status
// Генерирует файл status_string.go автоматически!

s := StatusActive
fmt.Println(s)         // "active" — использует String()
log.Printf("%v", s)   // "active"
log.Printf("%d", s)   // "1" — числовое значение
```

---

## 🔬 Reflection — когда и как

```go
import "reflect"

// Reflection позволяет inspectить типы и значения в runtime
// ДОРОГОСТОЯЩАЯ операция — использовать только когда нет альтернативы

func printFields(v any) {
    rv := reflect.ValueOf(v)
    if rv.Kind() == reflect.Ptr {
        rv = rv.Elem()
    }
    rt := rv.Type()
    
    for i := 0; i < rt.NumField(); i++ {
        field := rt.Field(i)
        value := rv.Field(i)
        fmt.Printf("%s: %v\n", field.Name, value.Interface())
    }
}

// Изменение значений через reflection
func setField(obj any, name string, value any) {
    rv := reflect.ValueOf(obj).Elem() // нужен pointer!
    field := rv.FieldByName(name)
    if field.IsValid() && field.CanSet() {
        field.Set(reflect.ValueOf(value))
    }
}

// Когда использовать:
// ✅ Serialization библиотеки (encoding/json внутри)
// ✅ Dependency injection frameworks (Wire, Fx)
// ✅ ORM (GORM читает struct tags через reflection)
// ❌ Business logic — используй generics или interfaces
// ❌ Hot paths — allocation overhead
```

---

## 🔬 Package Aliasing

```go
// Когда нужно resolve naming conflict или улучшить читаемость
import (
    "context"
    
    // Конфликт имён — aliasing
    pgxv4 "github.com/jackc/pgx/v4"
    pgxv5 "github.com/jackc/pgx/v5"
    
    // Длинное имя — сокращаем
    pb "github.com/company/proto/gen/payment/v1"
    
    // Side-effect import (blank alias)
    _ "github.com/lib/pq"
)

func connect() (*pgxv5.Conn, error) {
    return pgxv5.Connect(context.Background(), "postgres://...")
}
```

---

## 🔬 ORM в Go: варианты

```go
// 1. GORM — самый популярный, Rails-style
import "gorm.io/gorm"
var user User
db.Where("email = ?", email).First(&user)  // SELECT + LIMIT 1

// Проблемы GORM: магия, N+1 незаметно, сложные запросы = сырой SQL

// 2. sqlx — тонкий wrapper над database/sql
import "github.com/jmoiron/sqlx"
db.NamedExec(`INSERT INTO users (name, email) VALUES (:name, :email)`, user)
db.Select(&users, "SELECT * FROM users WHERE active = true")

// 3. pgx — нативный PostgreSQL driver, максимальная производительность
import "github.com/jackc/pgx/v5"
rows, _ := conn.Query(ctx, "SELECT id, name FROM users WHERE age > $1", 18)

// 4. Ent — type-safe query builder с кодогенерацией (от Facebook)
// 5. sqlc — генерирует Go код из SQL запросов (zero runtime overhead)

// Какой выбрать?
// Простой CRUD + команда знает ORM → GORM
// Production + performance → pgx или sqlx
// Type-safety + SQL control → sqlc (лучший выбор для новых проектов)
```

---

## ❓ Вопросы для интервью

### Чем `go vet` отличается от компилятора?

Компилятор проверяет синтаксис и типы. `go vet` — семантический анализ: логические ошибки которые синтаксически корректны. Пример: `fmt.Printf("%d", "string")` компилируется, но `go vet` поймает несоответствие типов.

### Зачем `b.ResetTimer()` в бенчмарке?

Benchmark включает время setup (например, создание тестовых данных). `ResetTimer()` исключает это время из измерения. Иначе benchmark включает overhead инициализации, а не реальную операцию.

### Когда `go generate` + `stringer` лучше ручной реализации `String()`?

При > 5-7 значений enum — генератор гарантирует что при добавлении нового значения `String()` обновится автоматически (через `go generate`). Ручная реализация легко забыть обновить → дефолтный `fmt.Sprintf("Status(%d)", int(s))` в production, что затруднит debugging.

---

## 📊 Итоговая шпаргалка инструментов

| Инструмент | Команда | Назначение |
|-----------|---------|-----------|
| go vet | `go vet ./...` | Статический анализ логических ошибок |
| golangci-lint | `golangci-lint run` | Meta-linter для CI |
| Coverage | `go test -coverprofile` | Измерение покрытия тестов |
| Benchmark | `go test -bench=. -benchmem` | Измерение производительности |
| benchstat | `benchstat old.txt new.txt` | Сравнение benchmarks |
| go doc | `go doc pkg.Symbol` | Документация |
| go generate | `go generate ./...` | Кодогенерация (stringer, mockery) |
| govulncheck | `govulncheck ./...` | CVE в зависимостях |
