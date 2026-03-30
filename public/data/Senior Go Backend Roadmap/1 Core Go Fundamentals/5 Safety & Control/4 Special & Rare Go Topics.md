# 🧠 Special & Rare Go Topics

## 📌 Что это такое

Редкие темы которые встречаются на Senior/Staff интервью. Не задаются каждый раз, но демонстрируют глубину знания Go runtime и toolchain.

---

## 🔬 1. cgo — Interop с C

```go
// cgo позволяет вызывать C код из Go и наоборот
// #include <stdlib.h>
import "C"
import "unsafe"

func getCString() string {
    cs := C.CString("hello") // Go string → C string (malloc!)
    defer C.free(unsafe.Pointer(cs)) // ОБЯЗАТЕЛЬНО освободить!
    return C.GoString(cs) // C string → Go string
}

// Когда НЕ использовать cgo:
// - Cross-compilation: cgo ломает GOOS/GOARCH cross-compile
// - Performance: каждый cgo вызов = переключение goroutine stack → OS thread
// - Static binary: cgo требует libc → нет distroless

// Когда оправдан:
// - Обёртка над legacy C библиотекой (libssl, libgdal)
// - Performance-critical bit manipulation (SIMD через C/Assembly)
```

---

## 🔬 2. Go Memory Model — "Happens-Before"

```go
// Go Memory Model гарантирует порядок видимости операций между горутинами

// НЕТ happens-before = нет гарантии что другая горутина увидит значение
var x int
go func() { x = 1 }() // нет synchronization
fmt.Println(x)         // может увидеть 0 или 1 — DATA RACE!

// Есть happens-before через sync примитивы:
var mu sync.Mutex
var x int

mu.Lock()
x = 1          // happens-before
mu.Unlock()    // ─────────────

mu.Lock()
fmt.Println(x) // гарантированно видит x = 1
mu.Unlock()

// channel send happens-before channel receive
ch := make(chan int, 1)
go func() {
    x = 42
    ch <- 1    // SEND: публикует x=42
}()
<-ch           // RECEIVE: гарантированно видит x=42
fmt.Println(x) // ✅ безопасно
```

---

## 🔬 3. Build Tags — Conditional Compilation

```go
//go:build linux && amd64
// +build linux,amd64  (старый синтаксис, совместимость)

package main

// Файл компилируется только на Linux amd64

// Использование:
// go build -tags=integration ./...

//go:build integration
// Тест включается только с -tags=integration
func TestDatabaseIntegration(t *testing.T) { ... }
```

```bash
# Cross-compilation
GOOS=linux GOARCH=arm64 go build ./cmd/server  # M1/M2 сервер на ARM
GOOS=windows GOARCH=amd64 go build ./...
GOOS=js GOARCH=wasm go build -o main.wasm ./cmd/wasm  # WebAssembly
```

---

## 🔬 4. Compile-time Interface Checks

```go
// Убеждаемся что тип реализует интерфейс — на этапе КОМПИЛЯЦИИ, не runtime
type Handler struct{}

// Явная проверка: ошибка компиляции если Handler не реализует http.Handler
var _ http.Handler = (*Handler)(nil)

// Полезно когда:
// - Большой интерфейс который легко забыть обновить
// - Public API library где важна обратная совместимость
// - Документирование намерений в коде

// Без этого — обнаружишь ошибку только при первом использовании
```

---

## 🔬 5. Slice Growth Formula (Go 1.18+)

```go
// До Go 1.18: при cap < 1024 → двоить, иначе +25%
// С Go 1.18: более плавный рост через threshold 256

// Упрощённо:
// newcap = oldcap + (oldcap + 3*256) / 4  (при oldcap > 256)

// Практическое следствие:
s := make([]int, 0)        // cap=0
s = append(s, 1)           // cap=1
s = append(s, 2)           // cap=2
s = append(s, 3)           // cap=4
s = append(s, 4, 5)        // cap=8... (doubling при small cap)

// Оптимизация: если знаешь размер — pre-allocate
result := make([]int, 0, len(input)) // нет reallocation!
```

---

## 🔬 6. Internal Packages

```
internal/ директория — Go enforced visibility:

mymodule/
├── internal/
│   └── auth/         ← НЕЛЬЗЯ импортировать снаружи mymodule!
│       └── token.go
├── api/
│   └── handler.go    ← может использовать internal/auth
└── cmd/
    └── server/
        └── main.go   ← может использовать internal/auth

github.com/other/pkg НЕЛЬЗЯ импортировать mymodule/internal/auth
→ Компилятор выдаст: use of internal package not allowed

Применение:
- Прячем implementation details от пользователей нашего пакета
- Принуждаем использовать публичный API
```

---

## 🔬 7. Blank Identifier Use Cases

```go
// 1. Игнорирование значений
for _, v := range slice { ... }       // игнорируем index
result, _ := strconv.Atoi("123")      // игнорируем error (ПЛОХО в prod!)

// 2. Side-effect imports (init() функции)
import _ "github.com/lib/pq"          // регистрирует postgres driver
import _ "net/http/pprof"             // регистрирует pprof endpoints

// 3. Compile-time interface check (см. выше)
var _ http.Handler = (*MyHandler)(nil)

// 4. Проверка что переменная использована (подавление ошибки компилятора)
_ = expensiveCall() // явно показываем что игнорируем результат намеренно
```

---

## 🔬 8. Pointer vs Value Receivers — когда что

```go
type Counter struct{ n int }

// Value receiver: метод работает с КОПИЕЙ
// Используй если: не мутируешь, struct маленькая, implements interface где нужен value
func (c Counter) Value() int { return c.n }

// Pointer receiver: метод работает с оригиналом
// Используй если: мутируешь поля, struct большая (избегаем копирование), sync.Mutex
func (c *Counter) Inc() { c.n++ }

// Правило консистентности:
// Если ХОТЬ ОДИН метод pointer — то ВСЕ методы должны быть pointer
// (иначе часть методов работает с копией, часть с оригиналом — confusing)

// НЕЛЬЗЯ вызвать pointer method на non-addressable value:
Counter{}.Inc()     // ❌ cannot take address of Counter{}
c := Counter{}
c.Inc()             // ✅ компилятор автоматически берёт &c
(&Counter{}).Inc()  // ✅ явно
```

---

## ❓ Вопросы для интервью

### Что такое "happens-before" и почему это важно?

Без happens-before гарантий CPU может переупорядочивать инструкции для оптимизации. В Go Memory Model: channel send/receive, mutex lock/unlock, sync.Once — все создают happens-before. Без них — data race. `go run -race` обнаруживает нарушения happens-before.

### Когда pointer receiver vs value receiver?

Pointer если: мутируешь, struct > 3-4 поля, содержит sync-примитивы (Mutex копировать нельзя!). Value если: неизменяемая операция + маленькая struct. Главное правило: консистентность. Все методы одного типа — либо pointer, либо value receivers.

### Чем `internal/` пакет отличается от простонепонятного имени?

Именование — конвенция, не enforcement. `internal/` — hard enforcement компилятором. Нельзя импортировать из другого модуля. При создании library: прячь детали реализации в `internal/` чтобы сохранить гибкость рефакторинга без breaking changes для users.
