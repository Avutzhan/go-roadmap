# 🧠 1. Big-O Analysis & Interview Code Quality

## 📌 Что это такое

Senior/Staff инженер на coding interview показывает не только "решил задачу", но и **думает вслух о complexity**, предлагает оптимизации, пишет production-quality код с правильными именами, обработкой edge-cases и объяснением trade-offs.

---

## 🔬 Big-O Complexity: правила и ловушки

### Основные сложности и их интерпретация

```
O(1)       — идеал: HashMap lookup, array access by index
O(log n)   — отлично: Binary search, balanced BST
O(n)       — хорошо: Single pass через массив
O(n log n) — приемлемо: Merge Sort, Heap Sort
O(n²)      — плохо: вложенные циклы, Bubble Sort
O(2^n)     — катастрофа: наивная рекурсия (Fibonacci)
O(n!)      — permutations — только с DP или pruning
```

### Амортизированная сложность

```go
// append к slice — O(1) амортизированно, O(n) worst case (realloc)
s := make([]int, 0)
for i := 0; i < n; i++ {
    s = append(s, i) // иногда копирует, но в среднем O(1)
}
// Итого: O(n) total, O(1) amortized per operation

// HashMap — O(1) amortized, O(n) worst case при коллизиях
m := make(map[string]int)
m["key"] = 1 // O(1) average, O(n) worst (очень редко с плохим hash)
```

### Пространственная сложность

```go
// Recursion depth = stack space!
func factorial(n int) int {
    if n <= 1 { return 1 }
    return n * factorial(n-1) // O(n) stack space!
}

// Итеративно: O(1) space
func factorialIter(n int) int {
    result := 1
    for i := 2; i <= n; i++ {
        result *= i
    }
    return result
}
```

---

## 🔬 Interview Code Quality Standards

### Что отличает Senior код на интервью

```go
// ❌ Junior решение (работает, но плохое качество):
func f(a []int, t int) int {
    for i := 0; i < len(a); i++ {
        for j := i + 1; j < len(a); j++ {
            if a[i]+a[j] == t {
                return i
            }
        }
    }
    return -1
}

// ✅ Senior решение:
// 1. Правильные имена
// 2. Ранний return для edge cases
// 3. Оптимальный алгоритм с объяснением
// 4. Комментарий к non-obvious логике

// findTwoSumIndex returns the index of first element that forms
// a pair summing to target. Returns -1 if no such pair exists.
// Time: O(n), Space: O(n)
func findTwoSumIndex(nums []int, target int) int {
    // Edge case: нечем формировать пару
    if len(nums) < 2 {
        return -1
    }
    
    // seen[complement] = index первого вхождения
    seen := make(map[int]int, len(nums))
    
    for i, num := range nums {
        complement := target - num
        if idx, ok := seen[complement]; ok {
            return idx // нашли пару: nums[idx] + nums[i] = target
        }
        seen[num] = i
    }
    return -1
}
```

### Процесс решения на интервью (Senior approach)

```
1. CLARIFY (2-3 минуты):
   □ "Может ли массив быть пустым?"
   □ "Могут ли быть отрицательные числа?"
   □ "Нужен ли один результат или все?"
   □ "Отсортирован ли массив?"
   □ "Constraints на размер n?"

2. BRUTE FORCE first (30 секунд объяснение):
   "Наивное решение: вложенные циклы O(n²). Это работает, но можем лучше."

3. OPTIMIZE (объясни идею ДО кода):
   "Если сохранять уже встреченные числа в HashMap — O(n) time, O(n) space"

4. CODE (чистый, с именами):
   Пиши и объясняй одновременно: "Итерирую по массиву, на каждом шаге ищу complement..."

5. TEST (обязательно!):
   □ Normal case
   □ Empty input
   □ Single element
   □ All same elements
   □ Target не найден

6. COMPLEXITY analysis:
   "Time: O(n) — один проход. Space: O(n) — HashMap до n элементов."
```

### Оптимизационные техники которые ценят интервьюеры

```go
// Техника 1: Pre-allocation для slice
// ❌ Рост через append без предварительного размера
result := []int{}

// ✅ Если знаем размер заранее
result := make([]int, 0, n) // capacity = n, нет reallocation

// Техника 2: Early termination
func containsDuplicate(nums []int) bool {
    seen := make(map[int]struct{}, len(nums))
    for _, n := range nums {
        if _, exists := seen[n]; exists {
            return true // ранний выход — не ждём конец массива
        }
        seen[n] = struct{}{}
    }
    return false
}

// Техника 3: Two-pointer вместо nested loops (для sorted arrays)
// Вместо O(n²) перебора всех пар → O(n) через left/right pointers

// Техника 4: Monotonic stack для "следующего большего элемента"
func nextGreaterElement(nums []int) []int {
    n := len(nums)
    result := make([]int, n)
    stack := []int{} // индексы элементов в убывающем порядке
    
    for i := n - 1; i >= 0; i-- {
        for len(stack) > 0 && nums[stack[len(stack)-1]] <= nums[i] {
            stack = stack[:len(stack)-1] // pop
        }
        if len(stack) == 0 {
            result[i] = -1
        } else {
            result[i] = nums[stack[len(stack)-1]]
        }
        stack = append(stack, i) // push
    }
    return result
}
```

---

## 🔥 Быстрые оценки сложности на интервью

```
Вложенные циклы по n и n: → O(n²)
Один цикл + binary search: → O(n log n)
Рекурсия разбивает на 2 части: → O(log n) или O(n log n) — зависит от работы на каждом уровне
DFS/BFS по графу: → O(V + E) — vertices + edges
Сортировка: → всегда O(n log n) нижняя граница для comparison-based

Правило hand: "Я думаю это O(X) потому что [одно предложение объяснения]"
Интервьюер ценит reasoning больше чем просто правильный ответ
```

---

## 💬 Как говорить на интервью

> "Я всегда начинаю с brute force и его сложности — это показывает что я понимаю задачу. Потом предлагаю оптимизацию с объяснением идеи до написания кода. После кода — обязательно тестирую edge cases вслух. Если есть time/space trade-off — объясняю оба варианта и предлагаю выбрать под контекст."

---

## ❓ Вопросы для интервью (Senior/Staff)

### Когда O(n log n) лучше O(n) с большой константой?

Для маленьких n (< 1000) константа важнее. Для больших n — асимптотика. Пример: Counting Sort O(n+k) — отличен когда range k мал. При k = INT_MAX (billions) — Merge Sort O(n log n) лучше. Всегда уточняй constraints!

### Почему `map[int]struct{}` лучше чем `map[int]bool` для "set"?

`struct{}` занимает 0 байт памяти (zero-size type). `bool` — 1 байт. При больших множествах: значимая экономия. Но главное: semantic — struct{} означает "presence only", нет risk присвоить `false` по ошибке.

### Как объяснить рекурсивную сложность?

Recursion tree method: нарисуй дерево вызовов. Сложность = листья × работа на узел. Fibonacci naive: 2^n листов × O(1) работа = O(2^n). С мемоизацией: каждое значение считается один раз = O(n) состояний × O(1) = O(n).

---

## 📊 Итоговая шпаргалка

| Паттерн | Time | Space | Когда |
|---------|------|-------|-------|
| Nested loops | O(n²) | O(1) | Brute force |
| HashMap | O(n) | O(n) | "Видел ли я X раньше?" |
| Two pointers | O(n) | O(1) | Sorted array, pairs |
| Binary search | O(log n) | O(1) | Sorted, "найди X" |
| Sliding window | O(n) | O(k) | Subarray условие |
| Monotonic stack | O(n) | O(n) | "Следующий больший" |
| DFS/BFS | O(V+E) | O(V) | Граф, дерево |
