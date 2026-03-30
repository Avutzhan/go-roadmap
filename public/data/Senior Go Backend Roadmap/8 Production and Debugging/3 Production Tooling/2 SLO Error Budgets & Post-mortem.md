# 🧠 3. SLO/SLA, Error Budgets & Production Culture

## 📌 Что это такое

SLO/SLA — не просто метрики, это **договор о качестве** между инженерами и бизнесом. Для Staff-инженера умение формулировать и защищать SLO — ключевой навык.

```
SLA (Service Level Agreement)  — внешний договор с клиентом/пользователем
SLO (Service Level Objective)  — внутренняя цель (строже SLA, есть буфер)
SLI (Service Level Indicator)  — реальная измеряемая метрика
Error Budget                   — допустимый объём "нарушений" SLO
```

---

## 🔬 Глубокий разбор (Senior/Staff)

### Правильные SLI: что измерять

```go
// Плохой SLI: uptime сервера (не коррелирует с user experience)
// Хороший SLI: доля успешных запросов с Latency < 200ms

// В Prometheus: запрос для SLI availability
// sum(rate(http_requests_total{code!~"5.."}[5m])) /
// sum(rate(http_requests_total[5m]))

// SLI Latency: доля запросов быстрее 200ms
// histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))

var (
    requestTotal = prometheus.NewCounterVec(
        prometheus.CounterOpts{Name: "http_requests_total"},
        []string{"code"},
    )
    requestDuration = prometheus.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "http_request_duration_seconds",
            Buckets: []float64{.005, .01, .025, .05, .1, .2, .5, 1, 2, 5},
        },
        []string{"handler"},
    )
)
```

### Error Budget: математика и политика

```
SLO = 99.9% availability (30-day window)
Error Budget = (1 - 0.999) * 30 дней * 24ч * 60мин = 43.2 минуты/месяц

Burnrate:
- Если расходуем budget в 14x быстрее нормального темпа → P1 Alert (вся команда)
- Если в 5x быстрее за 6 часов → Ticket, расследование
- Если budget исчерпан → feature freeze: только reliability работы
```

```go
// Пример алерта burnrate в Prometheus AlertManager rules.yaml
// - alert: ErrorBudgetBurnRateHigh
//   expr: |
//     (
//       sum(rate(http_requests_total{code=~"5.."}[1h])) /
//       sum(rate(http_requests_total[1h]))
//     ) > 14 * (1 - 0.999)
//   for: 5m
//   labels:
//     severity: critical
//   annotations:
//     summary: "Error budget burning 14x faster than normal"
```

### Incident Management: Post-mortem Culture

Структура правильного post-mortem:

```markdown
## Incident: Payment Service Timeout (2024-03-15)

**Impact**: 3.2% of payment requests failed for 23 minutes
**Error Budget Consumed**: 15/43 minutes (35%)

### Timeline
- 14:32 Alert fired: error rate > 1%
- 14:35 On-call engineer acknowledged
- 14:41 Root cause identified: DB connection pool exhausted
- 14:55 Fix deployed (MaxOpenConns increased + circuit breaker added)
- 14:55 Error rate back to baseline

### Root Cause
MaxOpenConns=10 for payment-db was exhausted under Black Friday load spike.
New requests queued until timeout.

### Contributing Factors
- No load testing for 3x baseline traffic
- No circuit breaker on payment-db calls

### Action Items
| Action | Owner | Due Date |
|--------|-------|----------|
| Add circuit breaker | @team-payments | 2024-03-22 |
| Load test for 5x baseline | @team-infra | 2024-03-29 |
| Increase MaxOpenConns to 50 | @on-call | 2024-03-15 ✅ |

### Blameless Conclusion
System design allowed this: no circuit breaker, no load testing. NOT human error.
```

**Ключевое**: blameless post-mortem — система виновата, не человек. Это создаёт культуру открытости.

### Chaos Engineering

```go
// Пример простого chaos tool — случайные задержки в тестовой среде
func ChaosMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        if os.Getenv("CHAOS_ENABLED") == "true" {
            if rand.Intn(100) < 5 { // 5% запросов
                delay := time.Duration(rand.Intn(500)) * time.Millisecond
                time.Sleep(delay)
            }
        }
        next.ServeHTTP(w, r)
    })
}
// Настоящий Chaos Engineering: Netflix Chaos Monkey, Gremlin
// Принцип: намеренно ломать систему в контролируемых условиях
// чтобы проверить resilience ПЕРЕД реальным инцидентом
```

---

## 🔥 Реальные боевые кейсы

- **Error Budget policy**: когда budget < 20% — автоматический freeze на новые деплои
- **Multi-window burn rate**: 1h и 6h окна — короткое ловит острые проблемы, длинное — медленные деградации
- **Synthetic monitoring**: запрос-"canary" каждую минуту — тест SLI даже в idle
- **Game Days**: плановые учения — "что если Kafka ляжет?" — разыгрываем сценарий до реального инцидента

---

## 💬 Как отвечать на интервью

> "SLO — это внутренний договор между инженерами и бизнесом. Устанавливаю SLO строже SLA — это Error Budget. Пока budget есть — мы деплоим новое. Когда исчерпан — feature freeze, только reliability. Burn rate алерты: 14x за час = P1, 5x за 6 часов = P2. Post-mortem — всегда blameless: система виновата, не люди. Chaos Engineering — намеренные сбои в staging чтобы знать, как система держится."

---

## ❓ Вопросы для интервью (Senior/Staff)

### Как объяснить Error Budget бизнесу (Product Manager)?

"У нас 43 минуты в месяц на ошибки. Если мы тратим их на deployment — остаётся меньше на случайные сбои. Значит: хотите больше и быстрее деплоить — надо инвестировать в автоматизацию тестов и rollback, чтобы каждый деплой стоил меньше из бюджета."

### Чем отличается Monitoring от Observability?

**Monitoring**: знаешь что мониторить — dashboards, алерты по известным метрикам.  
**Observability**: можешь ответить на **любой вопрос** о состоянии системы, даже который не предвидел заранее. Реализуется через: rich structured logs + distributed traces + metrics. Если ты не можешь ответить "почему именно этот запрос от этого пользователя упал?" — у тебя мониторинг, не observability.

### Как выбрать SLO для нового сервиса?

1. Поговори с пользователями: что для них «неприемлемо плохо»?
2. Посмотри на исторические данные: какая reliability была достигнута?
3. Не ставь 99.99% если текущая reliability 99.5% — это нереалистично.
4. Начни с более низкого SLO, измери, постепенно ужесточай по мере улучшения архитектуры.

---

## 📊 Итоговая шпаргалка

| Концепция | Смысл |
|-----------|-------|
| SLI | Измеримая метрика (% успешных запросов, p99 latency) |
| SLO | Цель (99.9% availability за 30 дней) |
| SLA | Договор с клиентом (с штрафами) |
| Error Budget | (1 - SLO) * период = допустимый объём сбоев |
| Burn Rate 14x | P1 алерт — горим в 14 раз быстрее нормы |
| Blameless PM | Система виновата → культура открытости |
| Chaos Engineering | Намеренные сбои для проверки resilience |
