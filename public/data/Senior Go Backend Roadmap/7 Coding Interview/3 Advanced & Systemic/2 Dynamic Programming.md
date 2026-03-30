# 🧠 Dynamic Programming: Patterns & Approaches

## 📌 Что это такое

Dynamic Programming (DP) — техника оптимизации рекурсивных задач через **мемоизацию** (top-down) или **табуляцию** (bottom-up). Ключевая идея: разбиваем задачу на перекрывающиеся подзадачи, решаем каждую один раз.

**Два признака "DP-задачи"**:
1. **Optimal substructure** — оптимальное решение строится из оптимальных решений подзадач
2. **Overlapping subproblems** — одни и те же подзадачи решаются повторно

---

## 🔬 Паттерн 1: Linear DP (1D)

### Задача: Fibonacci (базовый пример)

```go
// ❌ Naive рекурсия: O(2^n) — катастрофа
func fibNaive(n int) int {
    if n <= 1 { return n }
    return fibNaive(n-1) + fibNaive(n-2)
}

// ✅ Top-down с мемоизацией: O(n) time, O(n) space
func fibMemo(n int, memo map[int]int) int {
    if n <= 1 { return n }
    if v, ok := memo[n]; ok { return v }
    memo[n] = fibMemo(n-1, memo) + fibMemo(n-2, memo)
    return memo[n]
}

// ✅ Bottom-up табуляция: O(n) time, O(1) space
func fibDP(n int) int {
    if n <= 1 { return n }
    prev, curr := 0, 1
    for i := 2; i <= n; i++ {
        prev, curr = curr, prev+curr
    }
    return curr
}
```

### Задача: Longest Common Subsequence (LCS) — О(n*m)

```go
// Классический 2D DP: longest subsequence двух строк
func longestCommonSubsequence(text1, text2 string) int {
    m, n := len(text1), len(text2)
    dp := make([][]int, m+1)
    for i := range dp {
        dp[i] = make([]int, n+1)
    }
    
    for i := 1; i <= m; i++ {
        for j := 1; j <= n; j++ {
            if text1[i-1] == text2[j-1] {
                dp[i][j] = dp[i-1][j-1] + 1
            } else {
                dp[i][j] = max(dp[i-1][j], dp[i][j-1])
            }
        }
    }
    return dp[m][n]
}
```

---

## 🔬 Паттерн 2: Knapsack (0/1 и unbounded)

```go
// 0/1 Knapsack: каждый предмет берём 0 или 1 раз
// dp[i][w] = max value с i предметами и capacity w
func knapsack(weights, values []int, capacity int) int {
    n := len(weights)
    dp := make([][]int, n+1)
    for i := range dp {
        dp[i] = make([]int, capacity+1)
    }
    
    for i := 1; i <= n; i++ {
        for w := 0; w <= capacity; w++ {
            dp[i][w] = dp[i-1][w] // не берём предмет i
            if weights[i-1] <= w {
                // берём предмет i
                dp[i][w] = max(dp[i][w], dp[i-1][w-weights[i-1]]+values[i-1])
            }
        }
    }
    return dp[n][capacity]
}

// Оптимизация по памяти: 1D rolling array O(capacity)
func knapsack1D(weights, values []int, capacity int) int {
    dp := make([]int, capacity+1)
    for i, w := range weights {
        // Итерация справа налево КРИТИЧЕСКИ важна для 0/1 knapsack!
        for cap := capacity; cap >= w; cap-- {
            dp[cap] = max(dp[cap], dp[cap-w]+values[i])
        }
    }
    return dp[capacity]
}
```

---

## 🔬 Паттерн 3: Interval DP

```go
// Задача: Burst Balloons — максимальные монеты при взрыве воздушных шаров
// dp[i][j] = max coins для подмассива [i..j]
func maxCoins(nums []int) int {
    n := len(nums)
    // Добавляем граничные 1 для удобства
    balloons := make([]int, n+2)
    balloons[0], balloons[n+1] = 1, 1
    copy(balloons[1:], nums)
    
    dp := make([][]int, n+2)
    for i := range dp {
        dp[i] = make([]int, n+2)
    }
    
    // length = размер рассматриваемого окна
    for length := 1; length <= n; length++ {
        for left := 1; left <= n-length+1; left++ {
            right := left + length - 1
            for k := left; k <= right; k++ {
                // k — последний шар, который взрываем в [left, right]
                coins := balloons[left-1]*balloons[k]*balloons[right+1]
                coins += dp[left][k-1] + dp[k+1][right]
                dp[left][right] = max(dp[left][right], coins)
            }
        }
    }
    return dp[1][n]
}
```

---

## 🔬 Паттерн 4: State Machine DP

```go
// Задача: Best Time to Buy and Sell Stock с cooldown
// State: holding=0, sold=1, cooldown=2
func maxProfitWithCooldown(prices []int) int {
    if len(prices) == 0 { return 0 }
    
    hold := -prices[0]  // держим акцию
    sold := 0           // только что продали
    rest := 0           // cooldown / ничего не делаем
    
    for i := 1; i < len(prices); i++ {
        prevHold, prevSold, prevRest := hold, sold, rest
        hold = max(prevHold, prevRest-prices[i]) // купили или держим
        sold = prevHold + prices[i]              // продали
        rest = max(prevRest, prevSold)            // отдыхаем или продолжаем отдых
    }
    return max(sold, rest)
}
```

---

## 🔥 Как распознать DP на интервью

| Признак задачи | DP паттерн |
|---------------|------------|
| "Максимум/минимум" способов | 1D linear DP |
| Два строки/массива | 2D LCS-стиль |
| "Выбрать или не выбрать" | Knapsack |
| Интервалы/подстроки | Interval DP |
| Состояния машины | State machine DP |
| "Количество путей" | Paths DP |

---

## 💬 Как отвечать на интервью

> "Вижу DP, когда задача имеет optimal substructure — оптимальный ответ целой задачи строится из ответов подзадач. Начинаю с рекурсивного решения O(2^n), затем добавляю мемоизацию для O(n*m). Потом смотрю, можно ли заменить 2D таблицу rolling array — для 0/1 knapsack это обратная итерация. Всегда уточняю граничные условия: пустой массив, один элемент, отрицательные числа."

---

## ❓ Вопросы для интервью (Senior/Staff)

### Как отличить Greedy от DP?

Greedy: локально оптимальное решение ведёт к глобально оптимальному. Работает не всегда. DP: нужно рассмотреть **все** подзадачи. Пример: задача о сдаче монет — Greedy работает для монет `{1, 5, 10}`, но не для `{1, 3, 4}` (4=3+1 лучше 4=4, но 6: Greedy даст 4+1+1=3 монеты, DP: 3+3=2 монеты).

### Как перейти от top-down к bottom-up?

1. Определи базовые случаи (dp[0], dp[1])
2. Определи порядок вычислений (обычно i от 0 до n)
3. Замени рекурсивные вызовы на ячейки таблицы
4. Bottom-up обычно быстрее (нет call stack overhead) и позволяет оптимизировать память

### Почему в 0/1 Knapsack с 1D массивом итерация идёт справа налево?

Если итерировать слева направо, `dp[cap-w]` уже будет обновлён на текущей итерации — это означало бы взять предмет дважды (unbounded knapsack). Правая итерация гарантирует использование значений с предыдущего шага.

---

## 📊 Сложность популярных DP задач

| Задача | Time | Space |
|--------|------|-------|
| Fibonacci | O(n) | O(1) |
| LCS | O(n*m) | O(n*m) → O(min(n,m)) |
| 0/1 Knapsack | O(n*W) | O(n*W) → O(W) |
| Edit Distance | O(n*m) | O(n*m) → O(m) |
| Longest Palindromic Substring | O(n²) | O(n²) |
