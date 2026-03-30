# 🧠 2. Linked Lists & Fast-Slow Pointers

## 📌 Что это такое

Связные списки — классическая структура данных для интервью. Большинство задач решается двумя указателями. **Fast & Slow Pointer** (Floyd's algorithm) — один из самых элегантных алгоритмов: два указателя с разной скоростью движения решают несколько классов задач.

---

## 🔬 Паттерн: Fast & Slow Pointers

### Задача 1: Обнаружение цикла (Floyd's Cycle Detection)

```go
type ListNode struct {
    Val  int
    Next *ListNode
}

// O(n) time, O(1) space
func hasCycle(head *ListNode) bool {
    slow, fast := head, head
    
    for fast != nil && fast.Next != nil {
        slow = slow.Next       // 1 шаг
        fast = fast.Next.Next  // 2 шага
        
        if slow == fast { // встретились → цикл существует
            return true
        }
    }
    return false // fast достиг конца → цикла нет
}

// Почему работает: если цикл есть, fast "догонит" slow внутри цикла.
// Аналогия: бегуны на круглом стадионе — быстрый всегда догонит медленного.
```

### Задача 2: Найти начало цикла

```go
func detectCycle(head *ListNode) *ListNode {
    slow, fast := head, head
    
    // Шаг 1: найти точку встречи
    for fast != nil && fast.Next != nil {
        slow = slow.Next
        fast = fast.Next.Next
        if slow == fast {
            break
        }
    }
    
    if fast == nil || fast.Next == nil {
        return nil // нет цикла
    }
    
    // Шаг 2: математическое доказательство:
    // Расстояние от head до начала цикла = расстояние от meeting point до начала цикла
    // Поэтому: один указатель в head, другой в meeting point, двигаем по 1 шагу
    slow = head
    for slow != fast {
        slow = slow.Next
        fast = fast.Next
    }
    return slow // начало цикла
}
```

### Задача 3: Середина связного списка

```go
// O(n) за ОДИН проход (без подсчёта длины!)
func middleNode(head *ListNode) *ListNode {
    slow, fast := head, head
    
    for fast != nil && fast.Next != nil {
        slow = slow.Next
        fast = fast.Next.Next
    }
    // Когда fast достиг конца — slow на середине
    // Для чётного числа: slow на правом среднем элементе
    return slow
}
```

### Задача 4: Разворот связного списка (in-place)

```go
// O(n) time, O(1) space — фундаментальная операция
func reverseList(head *ListNode) *ListNode {
    var prev *ListNode
    curr := head
    
    for curr != nil {
        next := curr.Next // сохраняем следующий
        curr.Next = prev  // разворачиваем указатель
        prev = curr       // сдвигаем prev
        curr = next       // сдвигаем curr
    }
    return prev // prev теперь новый head
}

// Визуализация для 1→2→3→nil:
// Итерация 1: nil←1  2→3→nil  (prev=1, curr=2)
// Итерация 2: nil←1←2  3→nil  (prev=2, curr=3)
// Итерация 3: nil←1←2←3       (prev=3, curr=nil)
// Возвращаем 3←2←1←nil
```

### Задача 5: Палиндром (O(1) space)

```go
// Без дополнительной памяти!
func isPalindrome(head *ListNode) bool {
    // 1. Найти середину
    mid := middleNode(head)
    
    // 2. Развернуть вторую половину
    secondHalf := reverseList(mid)
    
    // 3. Сравнить обе половины
    p1, p2 := head, secondHalf
    for p2 != nil {
        if p1.Val != p2.Val {
            return false
        }
        p1 = p1.Next
        p2 = p2.Next
    }
    
    // 4. (Хорошая практика) восстановить список
    reverseList(secondHalf)
    return true
}
```

---

## 🔬 Паттерн: Merge & Sort

### LeetCode 21: Merge Two Sorted Lists

```go
// O(n+m) time, O(1) space
func mergeTwoLists(l1, l2 *ListNode) *ListNode {
    dummy := &ListNode{} // sentinel — упрощает код
    curr := dummy
    
    for l1 != nil && l2 != nil {
        if l1.Val <= l2.Val {
            curr.Next = l1
            l1 = l1.Next
        } else {
            curr.Next = l2
            l2 = l2.Next
        }
        curr = curr.Next
    }
    
    if l1 != nil {
        curr.Next = l1
    } else {
        curr.Next = l2
    }
    
    return dummy.Next
}
```

### K-th from End (без подсчёта длины)

```go
// Two pointer с gaps
func removeNthFromEnd(head *ListNode, n int) *ListNode {
    dummy := &ListNode{Next: head}
    fast, slow := dummy, dummy
    
    // fast опережает slow на n шагов
    for i := 0; i <= n; i++ {
        fast = fast.Next
    }
    
    // двигаем оба до конца
    for fast != nil {
        fast = fast.Next
        slow = slow.Next
    }
    
    // slow.Next = N-й с конца
    slow.Next = slow.Next.Next
    return dummy.Next
}
```

---

## 🔥 Реальные применения в production

- **Cycle detection**: обнаружение циклических зависимостей в графе конфигурации
- **LRU Cache**: doubly linked list + hash map (классика)
- **Browser history**: doubly linked list для back/forward navigation
- **Undo/Redo**: linked list operations history

---

## 💬 Как говорить на интервью

> "Для задач со связными списками сначала спрашиваю: нужно ли O(1) space? Если да — Fast/Slow pointer или in-place reversal. Всегда использую dummy header node — это убирает edge cases с head deletion. Для palindrome: найти середину + развернуть вторую половину + сравнить — это O(n) time O(1) space без массива."

---

## ❓ Вопросы для интервью (Senior/Staff)

### Почему dummy node упрощает код для linked list задач?

Без dummy: нужно отдельно обрабатывать случай когда удаляем head. С dummy: `dummy.Next = head`, операции всегда над `node.Next` — единый код для всех позиций. В конце возвращаем `dummy.Next`.

### Как Floyd's algorithm доказывает что slow=head и slow=meeting_point встретятся на входе в цикл?

Пусть расстояние от head до начала цикла = F. Длина цикла = C. Когда slow входит в цикл, fast уже C-F шагов впереди внутри цикла. Fast догоняет slow со скоростью 1 шаг/итерацию → встретятся через C-(C-F) = F итераций от входа в цикл. То есть: они встретятся на расстоянии F от начала цикла = расстоянию от head до начала. QED.

---

## 📊 Итоговая шпаргалка

| Задача | Паттерн | Complexity |
|--------|---------|------------|
| Cycle detection | Fast/Slow pointers | O(n) time, O(1) space |
| Middle of list | Fast/Slow pointers | O(n) time, O(1) space |
| Palindrome | Middle + Reverse | O(n) time, O(1) space |
| Kth from end | Two pointers + gap | O(n) time, O(1) space |
| Merge sorted | Dummy + pointer | O(n+m) time, O(1) space |
| Reverse list | Iterative | O(n) time, O(1) space |
