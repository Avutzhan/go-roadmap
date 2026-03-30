# 🧠 5.5 Security & Observability Patterns

## 📌 Что это такое

Этот раздел закрывает тему безопасности в распределённых системах и паттерны наблюдаемости на архитектурном уровне. Для Staff-инженера это не просто "добавить HTTPS" — это принципы defence-in-depth и observability-driven architecture.

---

## 🔬 Глубокий разбор (Senior/Staff)

### Zero Trust Architecture

Принцип: **"никому не доверяй по умолчанию"** — даже внутренним сервисам. Каждый запрос должен быть аутентифицирован и авторизован.

```go
// mTLS: взаимная аутентификация клиента и сервера
// Каждый сервис имеет свой TLS-сертификат (например, через SPIFFE/SPIRE)
tlsConfig := &tls.Config{
    // Требуем клиентский сертификат
    ClientAuth: tls.RequireAndVerifyClientCert,
    ClientCAs:  certPool, // доверенные CA для верификации клиентов
    // Наш сертификат
    Certificates: []tls.Certificate{serverCert},
}
server := &http.Server{
    TLSConfig: tlsConfig,
}
// Теперь сервис знает: кто именно к нему подключается (service identity)
```

### Defence in Depth: слои защиты

```
Internet
   ↓
[WAF / DDoS Protection]      ← Layer 1: Edge (Cloudflare, AWS Shield)
   ↓
[API Gateway + Rate Limiting] ← Layer 2: Entry point
   ↓
[Auth Service (JWT/OAuth2)]   ← Layer 3: Authentication
   ↓
[Service Mesh (mTLS)]         ← Layer 4: Service-to-service auth
   ↓
[RBAC / Policy (OPA)]         ← Layer 5: Authorization
   ↓
[Application Logic]           ← Layer 6: Business rules validation
   ↓
[Encrypted DB + Audit Log]    ← Layer 7: Data layer
```

### JWT: что проверять на Senior/Staff уровне

```go
import "github.com/golang-jwt/jwt/v5"

func validateToken(tokenString, secret string) (*Claims, error) {
    token, err := jwt.ParseWithClaims(tokenString, &Claims{},
        func(token *jwt.Token) (interface{}, error) {
            // КРИТИЧНО: проверяем алгоритм!
            if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
                return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
            }
            return []byte(secret), nil
        },
    )
    // Атака "alg:none": если не проверять Method, злоумышленник может прислать
    // токен без подписи. Go библиотека уязвима если не проверять явно.
    
    if err != nil {
        return nil, fmt.Errorf("invalid token: %w", err)
    }
    claims, ok := token.Claims.(*Claims)
    if !ok || !token.Valid {
        return nil, ErrInvalidToken
    }
    return claims, nil
}
```

### OWASP Top-10 в контексте Go-сервисов

```go
// A1: Injection — SQL Injection
// ❌ Уязвимо
query := fmt.Sprintf("SELECT * FROM users WHERE name = '%s'", userInput)

// ✅ Параметризованные запросы
rows, err := db.QueryContext(ctx, "SELECT * FROM users WHERE name = $1", userInput)

// A3: Sensitive Data Exposure
// ❌ Логируем sensitive data
log.Printf("processing payment for card: %s", cardNumber)

// ✅ Маскируем
log.Printf("processing payment for card: %s", maskCard(cardNumber)) // "****1234"

// A8: Insecure Deserialization
// ❌ Доверяем полностью user input при десериализации
var cmd AdminCommand
json.Unmarshal(req.Body, &cmd) // cmd может содержать опасные поля
```

---

## 🔬 Observability-Driven Architecture

### Structured Logging как архитектурный паттерн

```go
// Correlation ID через context — сквозное логирование
type contextKey string
const correlationIDKey contextKey = "correlation_id"

// Middleware устанавливает correlation ID
func CorrelationMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        correlationID := r.Header.Get("X-Correlation-ID")
        if correlationID == "" {
            correlationID = uuid.New().String()
        }
        ctx := context.WithValue(r.Context(), correlationIDKey, correlationID)
        w.Header().Set("X-Correlation-ID", correlationID)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}

// В любом месте кода:
func processOrder(ctx context.Context, orderID string) error {
    logger := log.With().
        Str("correlation_id", ctx.Value(correlationIDKey).(string)).
        Str("order_id", orderID).
        Logger()
    logger.Info().Msg("processing order")
    // Все логи этого запроса связаны одним correlation_id
}
```

### SLO/SLA/Error Budget архитектура

```
SLA (Service Level Agreement):  договор с клиентом/бизнесом
SLO (Service Level Objective):  внутренняя цель (строже SLA)
SLI (Service Level Indicator):  метрика (% успешных запросов)

Пример:
SLA: 99.9% availability (43.8 мин downtime/месяц)
SLO: 99.95% (чтобы был буфер)
SLI: (successRequests / totalRequests) * 100 за скользящие 30 дней

Error Budget = 1 - SLO = 0.05% = ~22 минуты/месяц
```

```go
// Prometheus метрика для SLI
var requestsTotal = prometheus.NewCounterVec(
    prometheus.CounterOpts{
        Name: "http_requests_total",
        Help: "Total HTTP requests by status class",
    },
    []string{"status_class"}, // "2xx", "4xx", "5xx"
)

// SLI = sum(rate(http_requests_total{status_class="2xx"}[30d])) /
//       sum(rate(http_requests_total[30d]))
```

---

## 🔥 Реальные боевые кейсы

- **JWT alg:none атака**: без проверки алгоритма можно обойти подпись
- **mTLS в Service Mesh**: каждый pod имеет свой SPIFFE-identity, никакого захардкоженного пароля
- **Error Budget on Fire**: если burn rate > 1x — нужно притормозить новые фьючи, если > 14x — инцидент
- **Correlation ID**: без него в 50 микросервисах невозможно отследить запрос

---

## 💬 Как отвечать на интервью

> "На уровне Staff безопасность — это архитектурное свойство, не болтовня к деплою. Я проектирую через defence-in-depth: WAF → API Gateway → Auth → mTLS mesh → RBAC → App validation → Encrypted storage. Для observability ключевой паттерн — correlation ID, прорастающий от edge до каждого лога. SLO/Error Budget — это договор с бизнесом о том, как мы расставляем приоритеты между стабильностью и скоростью."

---

## ❓ Вопросы для интервью (Senior/Staff)

### Как безопасно хранить секреты в K8s?

Kubernetes Secrets — base64, не шифрование. Это не Safe по умолчанию. Правильный путь: HashiCorp Vault или AWS Secrets Manager + CSI driver. Vault инжектирует секреты в pod как ephemeral volume — они не попадают в etcd в открытом виде. Rotation секретов — автоматически.

### Что такое OAuth2 PKCE и почему он важен для SPA/mobile?

PKCE (Proof Key for Code Exchange) защищает Authorization Code flow от code interception attack. SPA не может хранить client_secret, поэтому PKCE: генерируем code_verifier (случайная строка), хешируем в code_challenge, отправляем с auth request. При обмене code на token — отправляем code_verifier. Сервер сверяет хеш. Без PKCE перехваченный code даёт злоумышленнику токен.

### Как burn rate помогает управлять Error Budget?

Short window (1h) burn rate: если расходуем budget в 14x быстрее нормы — немедленный алерт, P1 инцидент. Long window (6h) at 5x — предупреждение. Это позволяет реагировать до того, как бюджет исчерпан, и не алертить на один плохой запрос.

---

## 📊 Итоговая шпаргалка

| Концепция | Суть |
|-----------|------|
| Zero Trust | Никакого неявного доверия, всегда аутентифицируй |
| mTLS | Взаимная auth сервисов через сертификаты |
| JWT alg check | Всегда проверяй alg — защита от alg:none |
| Defence in depth | Несколько независимых слоёв защиты |
| Correlation ID | Сквозной ID запроса через все сервисы |
| SLO + Error Budget | Договор с бизнесом, управление рисками деплоя |
