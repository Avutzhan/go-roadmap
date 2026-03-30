 b b# 3. Memory & Performance

### 3.1 Allocation & Ownership
*   **Stack vs Heap**: Где и почему аллоцируются данные. ✅
*   **Escape Analysis**: Механика принятия решения компилятором о выносе объекта в кучу. ✅
*   **Zero-copy techniques**: Оптимизация преобразований `[]byte` <-> `string`. ✅
*   **Pointer semantics**: Влияние указателей на работу GC и производительность. ✅

### 3.2 Garbage Collector Deep Dive
*   **Tri-color marking**: Алгоритм работы GC в Go. ✅
*   **Write barriers**: Как GC отслеживает изменения во время работы. ✅
*   **STW (Stop The World)**: Фазы и их влияние на latency. ✅
*   **GC Tuning**: Параметры `GOGC` и `GOMEMLIMIT` (Go 1.19+). ✅

### 3.3 High-Performance Tools
*   **sync.Pool**: Переиспользование объектов для снижения давления на GC. ✅
*   **Memory alignment**: Выравнивание полей в структурах и паддинг. ✅
*   **Inlining & Bound Check Elimination**: Как компилятор ускоряет код. ✅

### 3.4 Profiling & Analysis
*   **pprof**: CPU, Heap, Goroutine, Mutex и Block профайлинг. ✅
*   **Execution Tracer**: Анализ планирования и работы системных вызовов. ✅
*   **Benchmarking**: Написание качественных бенчмарков, `testing.B`. ✅

### 3.5 Memory Issues at Scale
*   **Memory fragmentation**: Причины и способы минимизации. ✅
*   **Huge Pages**: Использование на уровне ОС для Go приложений. ✅
*   **GC pauses**: Мониторинг и оптимизация пауз в высоконагруженных сервисах. ✅
