# 2. Concurrency & Parallelism (Deep Level)

### 2.1 Go Runtime & Scheduler
*   **The GMP model**: Роли Goroutine, Machine (OS Thread), Processor. ✅
*   **Work stealing & Hand-off**: Как планировщик перераспределяет нагрузку. ✅
*   **Syscalls handling**: Что происходит с P при блокирующем системном вызове. ✅
*   **Preemption**: Разница между кооперативной и некооперативной многозадачностью (Go 1.14+). ✅

### 2.2 Goroutines
*   **Stack management**: Динамический стек, стартовый размер 2KB, процесс расширения. ✅
*   **Lifecycle and leaks**: Как обнаруживать и предотвращать утечки горутин. ✅

### 2.3 Channels Internals
*   **hchan structure**: Циклический буфер, mutex, очереди ожидания (`recvq`, `sendq`). ✅
*   **State behavior**: Что происходит при чтении/записи в закрытый или nil канал. ✅
*   **Unbuffered vs Buffered**: Гарантии доставки и влияние на дизайн системы. ✅

### 2.4 Synchronization Primitives
*   **sync.Mutex vs sync.RWMutex**: Проблема голодания писателя (writer starvation). ✅
*   **sync.WaitGroup & sync.Once**: Паттерны инициализации и ожидания. ✅
*   **sync.Cond**: Сигнализация между горутинами. ✅
*   **Atomic operations**: Пакет `sync/atomic` для высокопроизводительных счетчиков и флагов. ✅

### 2.5 Memory Model & Consistency
*   **Happens-before relationship**: Гарантии видимости изменений между горутинами. ✅
*   **Race conditions**: Использование `-race` детектора и линтинга. ✅
*   **Wait-free / Lock-free**: Теоретические основы и применение в Go. ✅

### 2.6 Advanced patterns
*   **Worker Pools**: Динамическое и статическое управление количеством воркеров. ✅
*   **Pipelines**: Конвейерная обработка данных через каналы. ✅
*   **Fan-in / Fan-out**: Распараллеливание и сбор результатов. ✅
*   **Semaphore pattern**: Ограничение параллельного доступа через буферизованные каналы. ✅
*   **Context usage**: Глубокое понимание отмены (`Done()`) и передачи метаданных. ✅

### 2.7 Failures & Anti-patterns
*   **Deadlocks**: Причины и способы обнаружения. ✅
*   **Livelocks & Starvation**: Когда горутины работают, но прогресса нет. ✅
*   **Backpressure**: Стратегии обработки перегрузки (dropping, buffering). ✅
*   **Graceful shutdown**: Правильное завершение всех горутин при выходе приложения. ✅
