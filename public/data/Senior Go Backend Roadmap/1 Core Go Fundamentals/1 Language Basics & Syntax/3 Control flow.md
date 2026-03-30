# 🧠 3. Control Flow в Go

## 📌 Что это такое

Go намеренно ограничил control flow: нет `while`, нет `do-while`, нет тернарного оператора. Только `for`, `if`, `switch`, `select`. Но в деталях — много нюансов, которые отделяют Senior от Junior.

---

## 🔬 Глубокий разбор (Senior/Staff)

### `for` — единственный цикл, три формы

```go
// 1. Классический (как for в C)
for i := 0; i < 10; i++ { ... }

// 2. Как while
for condition { ... }

// 3. Бесконечный + break
for {
    select { ... } // типичный worker pattern
}

// 4. Range — по slice, map, channel, string
for i, v := range slice { ... }    // slice: index + value
for k, v := range m { ... }        // map: ключ-значение (НЕРАНДОМНЫЙ порядок)
for v := range ch { ... }          // channel: блокирует до close
for i, r := range "привет" { ... } // string: i=байт-позиция, r=Unicode rune
```

### ❗ Ловушка: goroutine + range loop variable

До Go 1.22 — классический баг:

```go
// ❌ Баг: все горутины захватят ОДНУ переменную v
for _, v := range items {
    go func() {
        fmt.Println(v) // v изменится к моменту запуска!
    }()
}

// ✅ Go < 1.22: явная копия
for _, v := range items {
    v := v // shadowing — создаём новую переменную
    go func() {
        fmt.Println(v)
    }()
}

// ✅ Go >= 1.22: переменная цикла уникальна для каждой итерации
// (поведение изменено в спецификации языка)
```

### `switch` — мощнее чем кажется

```go
// Без fallthrough — нет case-проваливания (в отличие от C)
switch status {
case http.StatusOK:
    handle200()
case http.StatusNotFound, http.StatusGone: // несколько значений
    handle4xx()
}

// Type switch — ключевой паттерн для интерфейсов
func describe(i interface{}) string {
    switch v := i.(type) {
    case int:
        return fmt.Sprintf("int: %d", v)
    case string:
        return fmt.Sprintf("string: %s", v)
    case error:
        return v.Error()
    default:
        return fmt.Sprintf("unknown: %T", v)
    }
}

// Switch без условия — как chain of if-else (читаемее!)
switch {
case temp < 0:
    fmt.Println("freezing")
case temp < 15:
    fmt.Println("cold")
default:
    fmt.Println("warm")
}
```

### `select` — сердце конкурентного Go

```go
// Мультиплексирование каналов — O(1) выбор готового канала
select {
case msg := <-ch1:
    process(msg)
case msg := <-ch2:
    process(msg)
case <-ctx.Done():          // отмена контекста
    return ctx.Err()
case <-time.After(5 * time.Second): // таймаут
    return ErrTimeout
default:                    // non-blocking check
    // выполнится если НИ ОДИН канал не готов
}
```

**Важно**: если несколько каналов готовы одновременно — `select` выбирает **случайно**. Это намеренно, для fairness.

### `goto` — когда это оправдано

```go
// Единственный легитимный кейс: выход из вложенных циклов
outer:
    for i := 0; i < 10; i++ {
        for j := 0; j < 10; j++ {
            if matrix[i][j] == target {
                goto found
            }
        }
    }
    return -1
found:
    return i*10 + j // ...хотя labeled break/continue чище
```

---

## 🔥 Реальные боевые кейсы

- **Worker с контекстом**: `for { select { case <-ctx.Done(): return } }` — стандартный long-running worker
- **Fan-out паттерн**: `range jobs` по каналу + запуск горутины на каждый job
- **Type switch** для десериализации полиморфных JSON-событий из Kafka
- **switch без условия** вместо длинной цепочки `if-else if` — значительно читаемее

---

## 💬 Как отвечать на интервью

> "В Go только один цикл — `for`, но он покрывает все сценарии: range по слайсам, каналам, строкам (где итерация по Unicode rune, не байтам). `select` — это `switch` для каналов с честным случайным выбором при множественной готовности. Ключевая ловушка — захват loop variable в горутине, которая исправлена семантически в Go 1.22. Для сложных control flow использую labeled break вместо goto."

---

## ❓ Вопросы для интервью (Senior/Staff)

### Что произойдёт при range по nil-каналу в select?

Канал `nil` **блокирует навсегда** — `case` с nil-каналом никогда не выбирается. Это можно использовать как паттерн для динамического "выключения" канала:

```go
var ch chan int // nil
select {
case v := <-ch: // никогда не выполнится
    ...
case <-done:
    return
}
```

### Гарантирован ли порядок итерации по map?

**Нет**. Порядок намеренно рандомизирован в runtime (с Go 1.0). Причина: разработчики хотели предотвратить зависимость от случайного порядка итерации. Если нужен порядок — извлеки ключи в slice, отсортируй, потом итерируй.

### Чем `for range` по string отличается от `for i := 0; i < len(s); i++`?

`range` итерирует по **Unicode rune** (code points). `len(s)` — это количество **байт**. Для многобайтовых UTF-8 символов (кириллица, китайский) `len()` будет больше числа символов. `range` корректно декодирует multi-byte rune.

```go
s := "привет"
fmt.Println(len(s))       // 12 (байт, UTF-8)
fmt.Println(len([]rune(s))) // 6 (символов)
```

### Когда `select` с `default` становится опасным?

В tight loop: `for { select { case v := <-ch: ...; default: } }` — без задержки это **busy-waiting**, который сожрёт 100% CPU. Правильно: добавить `runtime.Gosched()` или `time.Sleep` в default, или убрать default и позволить select заблокироваться.

---

## 📊 Итоговая шпаргалка

| Конструкция | Особенность |
|-------------|-------------|
| `for range` по string | Итерирует по rune (Unicode), не байтам |
| `for range` по map | Порядок случаен — всегда |
| `select` при мульти-ready | Случайный выбор (fairness) |
| `nil` channel в select | Блокирует вечно — никогда не выбирается |
| Loop var в goroutine | Баг до Go 1.22, исправлен семантически |
| `switch` fallthrough | Нужен явный `fallthrough` (в отличие от C) |
