# 🧠 Algorithm Preparation Map & Go Specifics

## 📌 Структура подготовки (2 уровня)

---

## 🟢 Level 1: Core Fundamentals (Base)
*Цель: решение 80% задач LeetCode Medium. Обязательный минимум для любого BigTech.*

### 1. Complexity & Basic Patterns
- **Big O**: Time & Space. Разница между `O(N)` и `O(N log N)`.
- **Two Pointers & Sliding Window**: оптимизация вложенных циклов в массивах/строках.
- **Prefix Sums & Difference Arrays**: быстрые запросы на отрезках.

### 2. Linear Data Structures
- **Linked Lists**: разворот, поиск середины, Floyd's Cycle-Finding.
- **Stacks & Queues**: Monotonic Stack (поиск ближайшего большего/меньшего).
- **Hash Maps**: принцип работы, разрешение коллизий, цена `O(1)` в worst case.

### 3. Trees & Graphs (Core)
- **Binary Trees**: DFS (Pre/In/Post-order) и BFS (Level-order).
- **Binary Search Tree (BST)**: свойства, поиск, вставка, удаление.
- **Recursion & Backtracking**: комбинации, перестановки, N-Queens.

### 4. Searching & Sorting
- **Binary Search**: классика + бинарный поиск по ответу.
- **Heaps (Priority Queues)**: K-largest elements, слияние K списков.
- **Basic DP**: Fibonacci, Staircase, Coin Change (1D DP).

---

## 🔴 Level 2: Advanced Topics (FAANG Hard)
*Цель: уверенное решение LeetCode Hard и системных оптимизаций.*

### 1. Advanced Graph Theory
- **Shortest Paths**: Dijkstra (с heap), Bellman-Ford (отрицательные веса), Floyd-Warshall (all-pairs).
- **Topological Sort**: Kahn's algorithm, поиск зависимостей в DAG.
- **Connectivity**: Disjoint Set Union (DSU) с Path Compression + Union by Rank.
- **Strongly Connected Components**: алгоритм Тарьяна или Косарайю.
- **Minimum Spanning Tree (MST)**: Prim's & Kruskal's.

### 2. Complex Data Structures
- **Trie (Prefix Tree)**: автодополнение, поиск по словарю.
- **Segment Tree & Fenwick Tree (BIT)**: изменение элемента + запрос суммы за `O(log N)`.
- **Monotonic Queue**: оптимизация Sliding Window Maximum.

### 3. Advanced Dynamic Programming
- **Multi-dimensional DP**: Edit Distance, LCS.
- **Bitmask DP**: задача коммивояжёра (TSP) на малых данных.
- **DP on Trees**: диаметр дерева, максимальное независимое множество.
- **Knapsack Variations**: 0/1, Unbounded, Bounded.

### 4. String Algorithms
- **KMP (Knuth-Morris-Pratt)**: поиск подстроки за `O(n+m)`.
- **Z-algorithm**: префикс-функция.
- *Go context*: `strings.Index` использует Rabin-Karp / Boyer-Moore внутри.

---

## 🐹 Go Specifics for Algorithms

```go
// Custom Sort: интерфейс sort.Interface
type ByLength []string
func (s ByLength) Len() int           { return len(s) }
func (s ByLength) Less(i, j int) bool { return len(s[i]) < len(s[j]) }
func (s ByLength) Swap(i, j int)      { s[i], s[j] = s[j], s[i] }

// Современный вариант с generics (Go 1.21+)
slices.SortFunc(arr, func(a, b int) int { return a - b })

// container/heap — Min-Heap
import "container/heap"

type MinHeap []int
func (h MinHeap) Len() int           { return len(h) }
func (h MinHeap) Less(i, j int) bool { return h[i] < h[j] }
func (h MinHeap) Swap(i, j int)      { h[i], h[j] = h[j], h[i] }
func (h *MinHeap) Push(x any)        { *h = append(*h, x.(int)) }
func (h *MinHeap) Pop() any {
    old := *h; n := len(old)
    x := old[n-1]; *h = old[:n-1]
    return x
}

h := &MinHeap{3, 1, 4}
heap.Init(h)
heap.Push(h, 2)
min := heap.Pop(h).(int) // 1

// sync.Pool для временных структур в algo-задачах
var bufPool = sync.Pool{
    New: func() any { return make([]int, 0, 1024) },
}
buf := bufPool.Get().([]int)
defer bufPool.Put(buf[:0]) // сброс длины, сохранение capacity

// Map iteration safety: нельзя удалять во время итерации
// Сначала собираем ключи, потом удаляем
toDelete := make([]string, 0)
for k, v := range m {
    if v == 0 { toDelete = append(toDelete, k) }
}
for _, k := range toDelete { delete(m, k) }
```

---

## 🚀 Strategy: How to Prepare

1. **Blind 75 / NeetCode 150**: золотой стандарт входа в BigTech.
2. **Standard Library**: прочитай исходники `sort`, `container/heap`, `container/list` в Go.
3. **Mock Interviews**: практикуйся объяснять решение вслух (Pramp, с коллегой).
4. **Patterns over Problems**: не заучивай задачи — учи паттерны.
   - "Shortest path in unweighted graph" → всегда BFS
   - "All combinations/subsets" → Backtracking
   - "Overlapping subproblems" → DP
   - "Next greater element" → Monotonic Stack

---

## ❓ Вопросы для интервью

### Почему передача слайса по значению дешёвая, но опасная?

Слайс = 3 поля (pointer, len, cap) — копирование дешёвое. Но underlying array shared. Если функция делает `append` сверх cap — создаётся новый backing array (caller не видит изменений). Если в рамках cap — mutation видна caller'у. Правило: возвращай слайс явно если изменяешь через append.

### Когда Dijkstra не работает?

При отрицательных весах рёбер. Dijkstra жадный — считает что как только посетил node, нашёл кратчайший путь. С отрицательными весами это неверно. Используй Bellman-Ford `O(V*E)`.

---

## 📊 Когда какой algо-паттерн

| Признак задачи | Паттерн |
|---------------|---------|
| Sorted array + find pair | Two Pointers |
| Subarray with condition | Sliding Window |
| Shortest path (unweighted) | BFS |
| Shortest path (weighted) | Dijkstra |
| Negative weights | Bellman-Ford |
| Detect cycle | DFS + visited state / Floyd |
| All combinations | Backtracking |
| Overlapping subproblems | DP (memo/tabulation) |
| Top-K / K-th largest | Heap |
| Prefix match / autocomplete | Trie |
| Next greater/smaller | Monotonic Stack |
