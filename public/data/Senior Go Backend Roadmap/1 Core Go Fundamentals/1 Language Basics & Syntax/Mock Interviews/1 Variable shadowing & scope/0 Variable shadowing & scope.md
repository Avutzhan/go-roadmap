# 🧠 1. Variable shadowing & scope

## 📌 Что это

В Go есть короткое объявление переменных:

```go
x := 10
```

Но если ты пишешь `:=` внутри блока — может создаться **новая переменная**, а не измениться старая.

```go
x := 10

if true {
    x := 20 // новая переменная!
}

fmt.Println(x) // 10
```

---

## 🧠 Простая аналогия

Это как в PHP:

```php
$x = 10;
if (true) {
    $x = 20; // перезапишется
}
```

👉 В Go — **может не перезаписаться**

---

## 💡 Зачем знать

Чтобы не ловить странные баги, особенно с `err`

---

# 🧠 1. Variable Shadowing & Scope (Senior)

## 📌 Что важно на уровне senior

### ❗ Shadowing = источник скрытых багов

```go
func process() error {
    err := doSomething()

    if err != nil {
        err := fmt.Errorf("wrapped: %w", err) // ❌ shadowing
        return err
    }

    return nil
}
```

👉 проблема:

* создаётся **новый `err`**
* внешний `err` не изменяется
* поведение может стать неочевидным

---

## 🔥 Где это реально ломает прод

* error handling
* транзакции (db tx)
* контексты (`ctx`)

---

## 💬 Как говорить на интервью

> "Я избегаю `:=` в уже объявленных переменных, особенно для `err`. Использую `=` чтобы не создать shadowing. Также linters (golangci-lint) помогают ловить такие случаи."

---  

```aiignore
func process() error {
    err := doSomething()

    if err != nil {
        err := fmt.Errorf("wrapped: %w", err) // ❌ shadowing
        return err
    }

    return nil
}
//Правило №1: если переменная уже есть → используем =
err := doSomething()

if err != nil {
    err = fmt.Errorf("wrapped: %w", err) // ✅
    return err
}

//Правило №2: не переиспользуй err в сложных местах. чище и безопаснее
err := doSomething()

if err != nil {
    wrappedErr := fmt.Errorf("wrapped: %w", err)
    return wrappedErr
}
//Правило №3: избегай := в if с уже существующими переменными
if err := doSomething(); err != nil {
нормально для коротких случаев, НО:
если внутри начнёшь делать ещё := → будет ад

//Правило №4: линтеры
Используй:
golangci-lint
правило: shadow
👉 он сразу скажет:
"ты затенил переменную"
```
❗ := = создание переменной
❗ = = изменение переменной

"Здесь используется :=, что создаёт новую переменную в текущем scope. Это может привести к shadowing и потенциальным багам, особенно если позже используется внешняя переменная. Я бы заменил := на = или использовал другое имя переменной."

| Ситуация            | Что делать         |
| ------------------- | ------------------ |
| переменная уже есть | `=`                |
| новый scope         | осторожно с `:=`   |
| err handling        | избегать shadowing |
| сомневаешься        | другое имя         |

Scope это блок {}
Это может быть:
функция
if
for
switch
даже {} вручную

```aiignore
func main() {
    x := 1 // scope #1 (function)

    if true {
        x := 2 // scope #2 (if block)
        fmt.Println(x) // 2
    }

    fmt.Println(x) // 1
}
внешний scope (функция)
внутренний scope (if)
```

`Shadowing happens when a variable with the same name is declared in an inner scope using :=, creating a new variable instead of modifying the outer one.`

❗ Shadowing = не ошибка компиляции
Go это разрешает, поэтому:
👉 это логическая ошибка, а не синтаксическая

💡 Когда это особенно опасно
* err
* ctx
* tx (transactions)
* loop variables + goroutines

```aiignore
func main() {
    x := 1

    if true {
        x := 2
        x = 3
        fmt.Println(x)
    }

    fmt.Println(x)
}

```

"In the inner block, x := 2 creates a new variable that shadows the outer x. The assignment x = 3 modifies the inner variable, not the outer one. Therefore, the inner print outputs 3, while the outer print still sees the original value 1."

---

## ⚡ Edge Cases (Senior Level)

### 🔥 1. Правило `:=` — хотя бы одна новая переменная

`:=` требует **хотя бы одну новую переменную** в левой части.

```go
x := 1

{
    x, y := 2, 3  // y новая → всё объявление создаёт переменные
                   // x тоже становится НОВОЙ (shadowing!)
}

fmt.Println(x) // 1 — внешний x не изменился
```

Критический кейс — **тот же scope**:

```go
x := 1
x, y := 2, 3  // x уже есть В ТОМ ЖЕ scope → обновляется (не shadowing)
              // y — новая, создаётся
fmt.Println(x) // 2
```

> Правило: в том же scope — `x` обновляется. В новом scope — создаётся новый `x` (shadowing).

---

### 🔥 2. Shadowing в `if` short statement

```go
err := doSomething()

if err := doOther(); err != nil {  // ❌ новый локальный err!
    return err
}

fmt.Println(err) // это СТАРЫЙ err от doSomething() — не тот что ты думаешь
```

Внутри `if err := ...; err != nil` создаётся **локальный** `err`, который живёт только в теле `if`. Внешний `err` не затронут.

---

### 🔥 3. Named return + shadowing (очень любят на интервью)

```go
func foo() (err error) {
    if err := doSomething(); err != nil {  // ❌ новый err, не named return!
        return err  // возвращаем локальный err — OK в данном случае
    }
    return  // naked return: вернёт named err (который nil, если не менялся)
}
```

Ловушка: кажется что `err` в `if` — это named return, но это **другой `err`**.

---

### 🔥 4. Loop + goroutines (closure ловушка)

```go
// ❌ Проблема: все горутины захватывают одну переменную v
for _, v := range nums {
    go func() {
        fmt.Println(v) // все напечатают последнее значение v
    }()
}

// ✅ Fix: shadow переменную явно (создать новую копию в каждой итерации)
for _, v := range nums {
    v := v  // shadowing — намеренное! создаём новый v в scope итерации
    go func() {
        fmt.Println(v) // каждая горутина видит свой v
    }()
}
```

> Начиная с **Go 1.22** (в go.mod `go 1.22`) loop variable per-iteration семантика изменена — `v` автоматически новая в каждой итерации. До 1.22 нужен явный `v := v`.

---

### 🔥 5. Инструменты обнаружения

```bash
# golangci-lint — главный инструмент (нужно включить правило):
golangci-lint run

# .golangci.yml:
linters:
  enable:
    - shadow

# Пример предупреждения:
# shadow: declaration of "err" shadows declaration at line X

# go vet — встроенный, менее строгий:
go vet ./...

# IDE (GoLand, VS Code + Go Extension) — подсвечивают shadowing прямо в коде
```

---

## 💬 Идеальный ответ на интервью

> *"Shadowing in Go happens when a variable is redeclared in an inner lexical scope using `:=`. Since `:=` creates a new variable if at least one identifier is new, it can unintentionally shadow outer variables. This is especially dangerous with `err` in `if` short statements, named returns, and in loops with goroutines. I avoid it by using `=` for reassignment, choosing distinct names, and using golangci-lint with the shadow rule enabled."*