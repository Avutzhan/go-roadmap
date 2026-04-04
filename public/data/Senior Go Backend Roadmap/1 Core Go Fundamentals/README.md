# 1. Core Go Fundamentals

### 1.1 Language Basics & Syntax
*   **Variable shadowing & scope**: Понимание влияния `:=` во внутренних блоках.  ✅
*   **Constants (iota)**: Создание перечислений и битовых масок.✅
*   **Control flow**: Особенности `switch` по типам и `for range` (копирование значений).✅
*   **Init functions**: Порядок выполнения в пакетах и при импорте.✅
*   **Zero value**: Значения по умолчанию для всех типов и их использование.✅
*   **Struct tags**: Метаданные для JSON, XML и ORM.✅

### 1.2 Data Structures Under the Hood
*   **Slices**: ✅
    - Структура хедера (pointer, len, cap).
    - Формула роста (порог 256).
    - Slice expressions `a[low:high:max]`.
    - Опасности разделяемого массива.
*   **Maps**: ✅
    - Устройство бакетов и хеш-таблицы.
    - Overflow бакеты и Load Factor.
    - Процесс эвакуации при расширении.
    - Почему map не потокобезопасна.
*   **Strings**: ✅
    - Неизменяемость (immutability).
    - Разница между `byte` (uint8) и `rune` (int32).
    - Эффективная конкатенация (`strings.Builder`).

### 1.3 Interfaces & Composition
*   **Interface internals**: Структуры `iface` и `eface`, и их поля `itab` и `data`. ✅
*   **Implicit implementation**: Duck typing в Go и его преимущества для мокирования (отличие от Java/C#). ✅
*   **Empty interface**: Разница между `interface{}` и `any` (введен в 1.18). ✅
*   **Embedding**: Встраивание структур и интерфейсов как альтернатива наследованию. ✅
*   **Compile-time checks**: Проверка реализации интерфейса (`var _ Interface = (*Impl)(nil)`). ✅

### 1.4 Error Handling
*   **Error wrapping**: Использование `%w`, `errors.Is` и `errors.As`. ✅  
*   **Custom errors**: Реализация интерфейса `error` для специфичных данных. ✅
*   **Strategy**: "Accept interfaces, return structs" в контексте ошибок. ✅
*   **Panic & Recover**: Механика работы, когда использование оправдано (boundary packages). ✅

### 1.5 Safety & Control
*   **Defer**: Порядок выполнения (LIFO), стоимость вызова, вычисление аргументов в момент объявления. ✅
*   **Unsafe package**: Риски использования `unsafe.Pointer` и когда это действительно нужно (системное программирование). ✅
*   **Go Modules**: Устройство `go.mod`, `go.sum`, работа с приватными репозиториями (`GOPRIVATE`). ✅

### 1.6 Special & Rare Topics
*   **CGO**: Интероп с C, оверхед на производительность, когда стоит избегать. ✅
*   **Internal packages**: Ограничения директории `internal/`. ✅
*   **Build Tags**: Условная компиляция (`//go:build`). ✅
*   **Generics**: Основы использования (с версии 1.18). ✅
*   **WebAssembly (WASM)** & **Go Mobile**: Базовое понимание возможностей Go вне бэкенда. ✅
