# 🧠 1. Table-Driven & Fuzz Testing in Go

## 📌 Что это такое

Table-driven tests — идиоматичный Go-паттерн: вместо десятков отдельных TestFunc пишем одну функцию с таблицей тест-кейсов. Fuzz-тестирование — автоматическая генерация входных данных для нахождения паник и crashes.

---

## 🔬 Глубокий разбор (Senior/Staff)

### Table-Driven Tests: правильная структура

```go
func TestParseAmount(t *testing.T) {
    t.Parallel() // параллельный запуск таблицы

    tests := []struct {
        name    string
        input   string
        want    float64
        wantErr bool
    }{
        {name: "valid integer", input: "100", want: 100.0, wantErr: false},
        {name: "valid decimal", input: "9.99", want: 9.99, wantErr: false},
        {name: "negative", input: "-1", want: 0, wantErr: true},
        {name: "empty string", input: "", want: 0, wantErr: true},
        {name: "overflow", input: "1e400", want: 0, wantErr: true},
        {name: "unicode", input: "１０", want: 0, wantErr: true}, // fullwidth digits
    }

    for _, tt := range tests {
        tt := tt // Go < 1.22: захват loop variable
        t.Run(tt.name, func(t *testing.T) {
            t.Parallel()
            got, err := ParseAmount(tt.input)
            if (err != nil) != tt.wantErr {
                t.Errorf("ParseAmount(%q) error = %v, wantErr %v", tt.input, err, tt.wantErr)
                return
            }
            if !tt.wantErr && got != tt.want {
                t.Errorf("ParseAmount(%q) = %v, want %v", tt.input, got, tt.want)
            }
        })
    }
}
```

**Почему `tt := tt`?** До Go 1.22, переменная цикла захватывается по ссылке в горутину `t.Run`. К моменту запуска — все `tt` уже одинаковые (последнее значение). Явное shadow-копирование решает проблему.

### testify: почему и как

```go
import (
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
)

// assert — при ошибке, тест продолжается
// require — при ошибке, тест ОСТАНАВЛИВАЕТСЯ (с t.FailNow())
func TestUserService(t *testing.T) {
    svc := NewUserService(mockRepo)
    
    user, err := svc.GetUser(ctx, "123")
    require.NoError(t, err, "GetUser должен быть успешным") // если err != nil — дальше нет смысла
    
    assert.Equal(t, "123", user.ID)
    assert.Equal(t, "John", user.Name)
    assert.False(t, user.Deleted)
    assert.WithinDuration(t, time.Now(), user.CreatedAt, time.Second)
}
```

### Fuzz Testing (Go 1.18+)

```go
// go test -fuzz=FuzzParseJSON ./...
// Go генерирует случайные входные данные и ищет паники/crashes

func FuzzParseJSON(f *testing.F) {
    // Seed corpus — начальные "интересные" входы
    f.Add([]byte(`{"id": 1}`))
    f.Add([]byte(`{}`))
    f.Add([]byte(`null`))
    
    f.Fuzz(func(t *testing.T, data []byte) {
        // Фаззер вызывает это с мутациями seed corpus
        var result MyStruct
        err := json.Unmarshal(data, &result)
        
        // Нас НЕ интересует ошибка — нас интересует ПАНИКА
        // Если функция паникует — фаззер это зафиксирует и сохранит
        // входные данные, вызвавшие панику, в testdata/fuzz/
        _ = err
        
        // Можно добавить invariant checks:
        if err == nil {
            if result.ID < 0 {
                t.Error("ID cannot be negative")
            }
        }
    })
}
```

**Реальный кейс**: Google нашёл через фаззинг множество уязвимостей в парсерах (ZIP, XML, JPEG), где специально сформированный input вызывал panic или buffer overflow.

### Benchmark Testing

```go
func BenchmarkParseAmount(b *testing.B) {
    b.ReportAllocs() // показать аллокации
    b.ResetTimer()   // сбросить таймер после setup

    for i := 0; i < b.N; i++ {
        _, _ = ParseAmount("1234.56")
    }
}

// go test -bench=BenchmarkParseAmount -benchmem -count=5
// Вывод:
// BenchmarkParseAmount-8   5000000   234 ns/op   32 B/op   2 allocs/op
//                          ^^^N       ^^^time     ^^^mem    ^^^allocs

// Сравнение версий через benchstat:
// go test -bench=. -benchmem -count=10 ./... | tee old.txt
// (правим код)
// go test -bench=. -benchmem -count=10 ./... | tee new.txt
// benchstat old.txt new.txt
```

---

## 🔥 Реальные боевые кейсы

- **JSON парсер + Fuzz**: нашли панику при `\x00` байте внутри строки — проблема в custom парсере
- **Table tests для HTTP handlers**: каждая строка таблицы — HTTP запрос + ожидаемый статус + тело ответа
- **BenchmarkMarshal**: сравнение `encoding/json` vs `github.com/goccy/go-json` (3x быстрее) — доказательство через benchstat
- **t.Parallel() в table tests**: сокращение времени тестов с 30s до 8s в большом сервисе

---

## 💬 Как отвечать на интервью

> "Table-driven tests — стандарт в Go. Ключевые нюансы: shadow-копия loop variable до Go 1.22, t.Parallel() для ускорения, require.NoError перед дальнейшими assertions (нет смысла проверять结果 если вернулась ошибка). Fuzz-тестирование ищет паники и непредвиденные крэши через автоматическую мутацию входов — особенно ценно для парсеров, десериализаторов. Benchmark + benchstat = доказательная оптимизация."

---

## ❓ Вопросы для интервью (Senior/Staff)

### Чем `require` отличается от `assert` в testify?

`assert` вызывает `t.Fail()` — тест помечается как неудачный, но продолжается. `require` вызывает `t.FailNow()` — тест мгновенно останавливается. Используй `require` когда дальнейшие проверки бессмысленны (нет смысла проверять поля объекта, если объект nil).

### Как фаззинг отличается от property-based тестирования?

Fuzzing: рандомные/мутированные байты → ищем panic/crash. Property-based (gopter/rapid): генерируем структурированные данные по типам → проверяем invariants. Для парсеров лучше Fuzzing. Для бизнес-логики (сортировка, математика) — property-based.

### Как тестировать concurrent код без race conditions в тестах?

```go
func TestConcurrentCache(t *testing.T) {
    cache := NewCache()
    var wg sync.WaitGroup
    
    for i := 0; i < 100; i++ {
        wg.Add(1)
        go func(i int) {
            defer wg.Done()
            cache.Set(fmt.Sprintf("key%d", i), i)
        }(i)
    }
    wg.Wait()
    // Запускаем с -race флагом: go test -race ./...
}
// Race detector найдёт concurrent read/write без mutex
```

---

## 📊 Итоговая шпаргалка

| Инструмент | Когда использовать |
|------------|-------------------|
| Table-driven | Всегда для функций с разными входами |
| t.Parallel() | Для независимых sub-tests — ускоряет в N раз |
| require.NoError | Когда ошибка делает дальнейшие проверки бессмысленными |
| Fuzz | Парсеры, десериализаторы, crypto, network protocols |
| Benchmark + benchstat | Доказательство оптимизации |
| -race flag | Обязателен в CI для обнаружения data races |
