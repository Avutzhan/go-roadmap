# 🧠 Panic/Recover, Closures & Advanced Go Patterns

## 📌 Что это такое

Темы которые часто задают на 100-вопросных списках но требуют Senior-глубины ответа — паника/восстановление, замыкания, method overloading в Go, idiomatic code.

---

## 🔬 Panic & Recover: механика и правила

```go
// panic: немедленно останавливает выполнение текущей горутины
// Разворачивает call stack, запуская все defer'ы
// Если никто не recover() — программа завершается с panic log

func riskyOperation() {
    panic("something went terribly wrong")
}

// recover(): перехватывает панику — ТОЛЬКО внутри defer!
func safeOperation() (err error) {
    defer func() {
        if r := recover(); r != nil {
            // r — значение переданное в panic()
            err = fmt.Errorf("recovered from panic: %v", r)
            // Опционально: логируем stack trace
            debug.PrintStack()
        }
    }()
    
    riskyOperation() // паника будет поймана
    return nil
}

// КРИТИЧНО: recover() работает ТОЛЬКО в той же горутине!
func main() {
    go func() {
        defer func() {
            if r := recover(); r != nil {
                log.Printf("goroutine panic: %v", r) // ✅ поймает
            }
        }()
        panic("goroutine panic")
    }()
    
    // НЕ поймает панику из другой горутины:
    defer func() { recover() }() // ❌ не поможет для горутин выше
    
    time.Sleep(time.Second)
}
```

### Правила использования panic/recover

```go
// ✅ Когда panic оправдан:
// 1. Программная ошибка (нарушение инварианта) которая НЕВОЗМОЖНА при корректном использовании
func mustParseURL(raw string) *url.URL {
    u, err := url.Parse(raw)
    if err != nil {
        panic(fmt.Sprintf("mustParseURL: invalid URL %q: %v", raw, err)) 
        // raw должен быть hardcoded константой, поэтому panic корректен
    }
    return u
}

// 2. Init() — если конфигурация невалидна, лучше упасть сразу
func init() {
    if os.Getenv("DB_URL") == "" {
        panic("DB_URL environment variable is required")
    }
}

// ❌ Когда panic НЕПРАВИЛЬНО:
// - Ожидаемые ошибки (network, IO, validation) → return error
// - В библиотечном коде — пользователь не ожидает panic

// ✅ recover в HTTP middleware — стандартный паттерн
func RecoveryMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        defer func() {
            if err := recover(); err != nil {
                log.Printf("panic recovered: %v\n%s", err, debug.Stack())
                http.Error(w, "Internal Server Error", 500)
            }
        }()
        next.ServeHTTP(w, r)
    })
}
```

---

## 🔬 Closures & Anonymous Functions: ловушки

```go
// Closure захватывает переменную по ССЫЛКЕ, не по значению

// ❌ Классическая ловушка (до Go 1.22):
funcs := make([]func(), 5)
for i := 0; i < 5; i++ {
    funcs[i] = func() {
        fmt.Println(i) // захватывает ПЕРЕМЕННУЮ i, не её значение!
    }
}
// Все напечатают 5, а не 0,1,2,3,4

// ✅ Fix 1: shadow копия (до Go 1.22)
for i := 0; i < 5; i++ {
    i := i // новая переменная в каждой итерации
    funcs[i] = func() { fmt.Println(i) }
}

// ✅ Fix 2: параметр функции
for i := 0; i < 5; i++ {
    funcs[i] = func(n int) func() {
        return func() { fmt.Println(n) }
    }(i)
}

// ✅ Go 1.22+: каждая итерация имеет свою переменную (автоматически)
// Поведение изменено: для >= go 1.22 в go.mod ловушки нет

// Closure для мемоизации:
func memoize(fn func(int) int) func(int) int {
    cache := make(map[int]int) // захвачен closure
    return func(n int) int {
        if v, ok := cache[n]; ok {
            return v
        }
        v := fn(n)
        cache[n] = v
        return v
    }
}

fibMemo := memoize(func(n int) int {
    if n <= 1 { return n }
    return n // упрощено
})
```

---

## 🔬 Method Overloading в Go (и как обойтись без него)

```go
// Go НЕ имеет method overloading — одно имя, одна сигнатура

// Подход 1: разные имена (идиоматично)
func ParseInt(s string) (int, error)      { ... }
func ParseFloat(s string) (float64, error) { ... }
func ParseBool(s string) (bool, error)    { ... }

// Подход 2: Functional Options (для "перегрузки" конструктора)
type ServerConfig struct {
    port    int
    timeout time.Duration
    maxConn int
}

type ServerOption func(*ServerConfig)

func WithPort(p int) ServerOption          { return func(c *ServerConfig) { c.port = p } }
func WithTimeout(t time.Duration) ServerOption { return func(c *ServerConfig) { c.timeout = t } }

func NewServer(opts ...ServerOption) *Server {
    cfg := &ServerConfig{port: 8080, timeout: 30 * time.Second} // defaults
    for _, opt := range opts {
        opt(cfg)
    }
    return &Server{cfg: cfg}
}

// Использование:
srv := NewServer(WithPort(9090), WithTimeout(60*time.Second))

// Подход 3: Generics (Go 1.18+)
func Max[T constraints.Ordered](a, b T) T {
    if a > b { return a }
    return b
}
Max(1, 2)        // int
Max(1.5, 2.5)    // float64
Max("a", "b")    // string
```

---

## 🔬 Idiomatic Go: что это на практике

```go
// 1. Accept interfaces, return structs
func NewRepo(db *sql.DB) *UserRepo { ... }     // ✅ возвращаем конкретный тип
func NewService(repo UserRepository) *Service { ... } // ✅ принимаем интерфейс

// 2. Errors as values, не исключения
result, err := doSomething()
if err != nil {
    return fmt.Errorf("doSomething: %w", err) // ✅ wrap с контекстом
}

// 3. Короткие переменные где понятно из контекста
for i, v := range items { ... }  // ✅ i и v понятны
for index, value := range items { ... } // ❌ избыточно

// 4. Не возвращать nil error со значением
func getUser(id string) (*User, error) {
    if id == "" {
        return nil, errors.New("empty id") // ✅
    }
    // НЕ делай:
    // return &User{}, nil при ошибке — вводит в заблуждение
}

// 5. Явный zero value вместо конструктора где возможно
var mu sync.Mutex   // ✅ usable без New()
var wg sync.WaitGroup // ✅
mu.Lock()

// 6. Don't panic, return error (в library code)
func ParseConfig(data []byte) (*Config, error) {
    // ✅ возвращаем ошибку, не паникуем
    var cfg Config
    if err := json.Unmarshal(data, &cfg); err != nil {
        return nil, fmt.Errorf("parse config: %w", err)
    }
    return &cfg, nil
}
```

---

## 🔬 Go's OOP: composition over inheritance

```go
// Go не имеет классов и наследования — только embedding (встраивание)

type Animal struct {
    Name string
}

func (a Animal) Speak() string {
    return a.Name + " makes a sound"
}

// Dog "наследует" через embedding — не наследование, а composition!
type Dog struct {
    Animal          // promoted fields & methods
    Breed string
}

func (d Dog) Speak() string {
    return d.Name + " barks" // override
}

d := Dog{Animal: Animal{Name: "Rex"}, Breed: "Husky"}
d.Animal.Speak() // "Rex makes a sound"
d.Speak()        // "Rex barks" — Dog's method wins
d.Name           // promoted field — как будто Dog.Name

// Interface satisfaction: implicit, не explicit
type Speaker interface {
    Speak() string
}

var s Speaker = Dog{...} // ✅ Dog реализует Speaker без explicit declaration
```

---

## ❓ Вопросы для интервью

### Может ли recover() поймать панику из другой горутины?

Нет. `recover()` работает только в той горутине где произошла паника. Если горутина паникует без своего `defer recover()` — runtime завершает всю программу. Каждая goroutine должна иметь свой recovery механизм. Поэтому в worker pools: `defer func() { if r := recover(); r != nil { ... } }()` внутри goroutine.

### Чем embedding отличается от наследования?

Embedding — composition, не inheritance. Dog не "является" Animal, Dog "содержит" Animal. Ключевые отличия: 1) нет полиморфизма — функция принимающая `Animal` не примет `Dog`. 2) Методы Animal promote в Dog, но их можно override. 3) Нет виртуальных функций — вызов через `d.Animal.Method()` всегда идёт к Animal версии.

### Что значит "idiomatic Go"?

Код, который следует Go-конвенциям: принимает интерфейсы — возвращает structs; ошибки как values с `%w` wrapping; zero values usable; goroutines с context cancellation; table-driven tests; маленькие интерфейсы; no premature abstraction. Идиоматичный Go читается как стандартная библиотека.
