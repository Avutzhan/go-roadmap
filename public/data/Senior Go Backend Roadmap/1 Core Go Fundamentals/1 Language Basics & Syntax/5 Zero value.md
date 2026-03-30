# 🧠 5. Zero Values

## 📌 Что это такое

В Go **каждый тип имеет zero value** — значение по умолчанию при объявлении переменной без явной инициализации. Это фундамент безопасности Go: нет неинициализированной памяти.

```go
var i int       // 0
var f float64   // 0.0
var b bool      // false
var s string    // ""
var p *int      // nil
var sl []int    // nil (не пустой slice!)
var m map[string]int // nil
var fn func()   // nil
var iface interface{} // nil
```

---

## 🔬 Глубокий разбор (Senior/Staff)

### Nil slice vs empty slice — критическая разница

```go
var nilSlice []int          // nil — len=0, cap=0, ptr=nil
emptySlice := []int{}       // не nil — len=0, cap=0, ptr=<non-nil>
emptySlice2 := make([]int, 0) // не nil

// Функциональная разница:
nilSlice == nil    // true
emptySlice == nil  // false

// НО: оба безопасны для append
nilSlice = append(nilSlice, 1)    // ✅ OK
emptySlice = append(emptySlice, 1) // ✅ OK

// ВАЖНО: JSON сериализация
json.Marshal(nilSlice)   // "null"
json.Marshal(emptySlice) // "[]"
// Это критично для API: клиент получит разные ответы!
```

### Nil map — читай можешь, записываешь — panic!

```go
var m map[string]int

// Чтение из nil map — safe, возвращает zero value ключа
v := m["key"] // v = 0, паники нет
v, ok := m["key"] // ok = false, паники нет

// Запись в nil map — PANIC
m["key"] = 1 // ❌ panic: assignment to entry in nil map
```

**Правило**: всегда инициализируй map перед записью: `m := make(map[string]int)`.

### Zero value как паттерн проектирования (Usable Without Init)

Лучший код в Go — когда тип **сразу используем** в zero value. Стандартная библиотека построена на этом:

```go
// sync.Mutex — zero value это unlocked mutex
var mu sync.Mutex // не нужен конструктор!
mu.Lock()
defer mu.Unlock()

// bytes.Buffer — zero value это пустой буфер
var buf bytes.Buffer
buf.WriteString("hello")

// sync.WaitGroup — zero value готов к использованию
var wg sync.WaitGroup
wg.Add(1)

// Твой тип тоже может быть таким:
type Cache struct {
    mu    sync.Mutex            // zero: unlocked
    items map[string]string     // zero: nil — НУЖНА инициализация!
}

// Lazy init pattern для map внутри struct
func (c *Cache) Get(key string) (string, bool) {
    c.mu.Lock()
    defer c.mu.Unlock()
    v, ok := c.items[key] // safe для nil map при чтении
    return v, ok
}

func (c *Cache) Set(key, value string) {
    c.mu.Lock()
    defer c.mu.Unlock()
    if c.items == nil {
        c.items = make(map[string]string) // lazy init
    }
    c.items[key] = value
}
```

### Сравнение nil-интерфейсов — главная ловушка

```go
type MyError struct{ msg string }
func (e *MyError) Error() string { return e.msg }

func getError() error {
    var err *MyError = nil // typed nil pointer
    return err             // ❌ интерфейс НЕ nil!
}

err := getError()
if err != nil { // true! — потому что интерфейс содержит тип (*MyError), даже с nil-значением
    fmt.Println("got error") // выполнится!
}
```

**Правило**: никогда не возвращай типизированный nil через интерфейс. Возвращай `nil` напрямую:

```go
func getError() error {
    var err *MyError = nil
    if err == nil {
        return nil // ✅ чистый nil-интерфейс
    }
    return err
}
```

---

## 🔥 Реальные боевые кейсы

- **API responses**: `nil` slice → JSON `null` vs `[]` → сломанный клиент. Всегда инициализируй slice при возврате: `result := make([]Item, 0)`
- **nil interface bug**: возврат `(*MyError)(nil)` через `error` — классика Senior-ловушек
- **sync.Mutex** zero value: не требует `New()` — паттерн "usable without init"
- **Cache с lazy init**: безопасное чтение из nil map + ленивая инициализация при записи

---

## 💬 Как отвечать на интервью

> "Zero value в Go — это не просто дефолты, это философия: тип должен быть полезен без явного конструктора. Например, sync.Mutex и bytes.Buffer работают из zero value. Главные ловушки: nil map паникует при записи (но безопасен при чтении), nil slice маршалится в JSON null (не []), и самое опасное — типизированный nil pointer, возвращённый через интерфейс, не равен nil. Это классическая ошибка в error handling."

---

## ❓ Вопросы для интервью (Senior/Staff)

### Почему `nil` slice лучше empty slice как zero value для функций?

Semantic: `nil` slice означает "нет данных", empty slice — "данные есть, но их 0". Для API это важно. Для performance: `nil` slice не делает никаких аллокаций, `append` к nil — эффективен. Возвращай `nil` если нет элементов, только если API явно не требует `[]`.

### Как безопасно работать с optional-полями в struct через указатели?

```go
type Config struct {
    Timeout *time.Duration // nil = use default
}

func (c *Config) GetTimeout() time.Duration {
    if c.Timeout == nil {
        return 30 * time.Second // default
    }
    return *c.Timeout
}
```

Указатель как zero value (`nil`) позволяет различать "не установлено" и "установлено в 0". Это паттерн optional fields.

### Что такое zero value для channel и interface{}?

Channel zero value — `nil`. Отправка в nil channel блокирует вечно. Получение из nil channel блокирует вечно. `close(nil channel)` — паника. Interface zero value — `nil` с `nil` типом И `nil` значением (только такой nil-интерфейс `== nil`).

---

## 📊 Итоговая шпаргалка

| Тип | Zero value | Опасность |
|-----|-----------|-----------|
| `int`, `float` | `0` / `0.0` | — |
| `bool` | `false` | — |
| `string` | `""` | — |
| `*T` (pointer) | `nil` | разыменование → panic |
| `[]T` (slice) | `nil` | JSON→null, len/cap=0 безопасно |
| `map[K]V` | `nil` | запись → panic, чтение OK |
| `chan T` | `nil` | send/receive блокируют вечно |
| `interface{}` | `nil` | typed nil ptr != nil interface! |
| `func` | `nil` | вызов → panic |