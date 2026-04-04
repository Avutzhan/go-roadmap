# 🧠 1. Go Modules Deep Dive

## 📌 Что это такое

Go Modules — официальная система управления зависимостями (с Go 1.11). `go.mod` описывает модуль и его зависимости. `go.sum` — криптографически подписанные хеши для верификации целостности.

---

## 🔬 Глубокий разбор (Senior/Staff)

### Структура go.mod и семантическое версионирование

```
module github.com/company/service  // путь модуля

go 1.22  // тулчейн версия

require (
    github.com/pkg/errors v0.9.1
    github.com/stretchr/testify v1.8.4
    golang.org/x/sync v0.6.0
)

replace (
    // Локальная замена — для монорепо или временных форков
    github.com/company/shared => ../shared  
)

exclude (
    // Исключаем конкретную версию с известной уязвимостью
    golang.org/x/text v0.3.7
)
```

### MVS: Minimum Version Selection

Go использует **MVS** — выбирает **минимально достаточную** версию, удовлетворяющую всем зависимостям. Это противоположность npm (который берёт latest).

```
A требует B >= v1.2
C требует B >= v1.5

Go выберет B v1.5 (минимум, удовлетворяющий обоим)
npm мог бы взять latest B v2.0 (с возможными breaking changes)
```

**Преимущество MVS**: детерминированные, воспроизводимые билды. Версия зависимости не меняется, пока ты явно не обновишь.

### Major Version в импорте (v2+)

Go специфика: major version >= 2 включается в import path:

```go
// v1
import "github.com/gin-gonic/gin"

// v2 — breaking change, другой путь
import "github.com/gin-gonic/gin/v2"

// Они могут сосуществовать в одном проекте!
// Это называется "semantic import versioning"
```

### go.sum и безопасность

```bash
# go.sum содержит хеши для каждой версии
github.com/pkg/errors v0.9.1 h1:FEBLx1zS214owpjy7qsBeixbURkuhQAwrK5UwLGTwt38=
github.com/pkg/errors v0.9.1/go.mod h1:bwawxfHBFNV+L2hUp1rHADufV3IMtnDRdf1r5NINEl0=

# Если хеш не совпадает — go откажется скачивать пакет
# GONOSUMCHECK и GONOSUMDB для приватных репозиториев
```

### Воспроизводимые сборки в Docker

```dockerfile
FROM golang:1.22-alpine AS builder
WORKDIR /app

# СНАЧАЛА только mod файлы — для Docker кэша слоёв
COPY go.mod go.sum ./
RUN go mod download  # кешируется отдельным слоем

# ПОТОМ исходный код
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags="-w -s -X main.version=$(git rev-parse --short HEAD)" \
    -o /app/server ./cmd/server
```

**Критично**: `-w -s` убирает debug info и DWARF → бинарник в 2-3 раза меньше. `-X main.version` вшивает git hash в бинарник.

### Управление private modules

```bash
# Для приватных репо в CI/CD
export GONOSUMCHECK=github.com/company/*
export GOFLAGS=-mod=vendor  # использовать vendor/ папку
export GOPRIVATE=github.com/company  # не использовать proxy

# или в .netrc / git config для auth
```

---

## 🔥 Реальные боевые кейсы

- **CVE в зависимости**: `govulncheck ./...` ищет известные уязвимости в go.mod — обязательно в CI
- **Vendor mode**: `go mod vendor` + `-mod=vendor` — детерминированные offline-сборки в air-gapped окружениях
- **Replace директива** в монорепо: `replace github.com/company/shared => ../../shared`
- **Dependency confusion**: важно проверить, что приватные пакеты не перехватываются публичным proxy

---

## 💬 Как отвечать на интервью

> "Go Modules с MVS дают детерминированные сборки — нет сюрпризов от обновлений. В продакшене я настраиваю GOPRIVATE для private репо, использую govulncheck в CI, и всегда pinuю версии в go.sum. Для Docker — сначала копирую go.mod/go.sum для кеширования слоя зависимостей, потом код. v2+ пакеты имеют другой import path — это semantic import versioning, позволяющий сосуществовать двум major версиям."

---

## ❓ Вопросы для интервью (Senior/Staff)

### Что произойдёт при `go get -u` в проекте с жёсткими SLA?

`go get -u` обновляет все прямые зависимости до последней minor/patch версии. Это может сломать поведение без breaking changes (например, изменение тайаутов по умолчанию). В продакшене использую `go get github.com/pkg/errors@v0.9.1` для явного pin. **Автоматические обновления** — только через Dependabot/Renovate с тестами.

### Как `go work` помогает в монорепо?

```
go.work
├── module ./service-a
├── module ./service-b  
└── module ./shared

# Локальная разработка: service-a видит локальный shared
# без replace директивы в go.mod
```

`go work` — workspace mode, где несколько модулей работают вместе без публикации.

### Что такое "diamond dependency problem" и как Go его решает?

A зависит от B v1.2 и C. C зависит от B v1.5. Python/npm создали бы конфликт или установили обе версии. Go MVS: берёт B v1.5 (максимум минимальных требований). **Одна версия зависимости на всю сборку** — нет runtime confusion от нескольких версий одного пакета.

---

## 📊 Итоговая шпаргалка

| Команда | Описание |
|---------|---------|
| `go mod tidy` | Убрать неиспользуемые, добавить нужные |
| `go mod download` | Скачать в кеш без сборки |
| `go mod vendor` | Копировать зависимости в vendor/ |
| `go get pkg@v1.2.3` | Явно задать версию |
| `govulncheck ./...` | Проверить CVE в зависимостях |
| `go mod graph` | Граф зависимостей |
| `GONOSUMCHECK` | Приватные пакеты без sum проверки |
