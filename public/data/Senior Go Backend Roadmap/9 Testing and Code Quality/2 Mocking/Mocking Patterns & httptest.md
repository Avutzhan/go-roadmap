# 🧠 1. Mocking Patterns, Interfaces & httptest

## 📌 Что это такое

Правильный мокинг в Go строится на **интерфейсах**, а не на "магических" фреймворках. Принцип: если код принимает интерфейс — его легко замокать. `httptest` — стандартная библиотека для тестирования HTTP без реального сервера.

---

## 🔬 Глубокий разбор (Senior/Staff)

### Паттерн 1: Manual Mock через интерфейс

```go
// Определяем интерфейс в production коде
type UserRepository interface {
    GetByID(ctx context.Context, id string) (*User, error)
    Save(ctx context.Context, user *User) error
}

// Production реализация
type postgresUserRepo struct {
    db *sql.DB
}

// Мок для тестов — в test файле
type mockUserRepo struct {
    users map[string]*User
    // Spy: записываем вызовы для проверки
    saveCallCount int
    savedUsers    []*User
}

func (m *mockUserRepo) GetByID(ctx context.Context, id string) (*User, error) {
    if u, ok := m.users[id]; ok {
        return u, nil
    }
    return nil, ErrNotFound
}

func (m *mockUserRepo) Save(ctx context.Context, user *User) error {
    m.saveCallCount++
    m.savedUsers = append(m.savedUsers, user)
    if m.users == nil {
        m.users = make(map[string]*User)
    }
    m.users[user.ID] = user
    return nil
}

// Тест
func TestUserService_CreateUser(t *testing.T) {
    repo := &mockUserRepo{users: make(map[string]*User)}
    svc := NewUserService(repo)

    err := svc.CreateUser(ctx, "alice", "alice@example.com")
    
    require.NoError(t, err)
    assert.Equal(t, 1, repo.saveCallCount, "Save должен быть вызван один раз")
    require.Len(t, repo.savedUsers, 1)
    assert.Equal(t, "alice", repo.savedUsers[0].Name)
}
```

### Паттерн 2: mockery / gomock (генерация моков)

```bash
# mockery генерирует мок из интерфейса автоматически
# go install github.com/vektra/mockery/v2@latest
mockery --name=UserRepository --output=mocks --outpkg=mocks
```

```go
// Сгенерированный мок
// mocks/UserRepository.go

// Использование с testify/mock:
func TestUserService_GetUser(t *testing.T) {
    mockRepo := &mocks.UserRepository{}
    
    // Устанавливаем ожидание:
    mockRepo.On("GetByID", mock.Anything, "user-123").
        Return(&User{ID: "user-123", Name: "Alice"}, nil)
    
    svc := NewUserService(mockRepo)
    user, err := svc.GetUser(ctx, "user-123")
    
    require.NoError(t, err)
    assert.Equal(t, "Alice", user.Name)
    mockRepo.AssertExpectations(t) // проверяем что все On() вызваны
}
```

### Паттерн 3: Functional Options для тестовых зависимостей

```go
type Service struct {
    repo   UserRepository
    mailer Mailer
    clock  func() time.Time // injectable clock
}

func NewService(opts ...Option) *Service {
    s := &Service{
        clock: time.Now, // default
    }
    for _, o := range opts {
        o(s)
    }
    return s
}

type Option func(*Service)

func WithClock(fn func() time.Time) Option {
    return func(s *Service) { s.clock = fn }
}

// В тестах:
fixedTime := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
svc := NewService(
    WithRepo(mockRepo),
    WithClock(func() time.Time { return fixedTime }),
)
```

### httptest: тестирование HTTP handlers

```go
// Тестирование Handler без запуска реального сервера

func TestOrderHandler_Create(t *testing.T) {
    // Mocked dependencies
    mockSvc := &mockOrderService{}
    handler := NewOrderHandler(mockSvc)

    tests := []struct {
        name       string
        body       string
        setupMock  func()
        wantStatus int
        wantBody   string
    }{
        {
            name:       "valid order",
            body:       `{"product_id": "p1", "qty": 2}`,
            setupMock:  func() { mockSvc.On("Create", ...).Return(&Order{ID: "o1"}, nil) },
            wantStatus: http.StatusCreated,
            wantBody:   `"id":"o1"`,
        },
        {
            name:       "invalid JSON",
            body:       `{invalid}`,
            wantStatus: http.StatusBadRequest,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            if tt.setupMock != nil {
                tt.setupMock()
            }
            req := httptest.NewRequest(http.MethodPost, "/orders", strings.NewReader(tt.body))
            req.Header.Set("Content-Type", "application/json")
            
            w := httptest.NewRecorder()
            handler.ServeHTTP(w, req)
            
            assert.Equal(t, tt.wantStatus, w.Code)
            if tt.wantBody != "" {
                assert.Contains(t, w.Body.String(), tt.wantBody)
            }
        })
    }
}

// httptest.Server — для тестирования HTTP клиентов
func TestPaymentClient_Charge(t *testing.T) {
    // Поднимаем реальный HTTP сервер в тесте
    server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        assert.Equal(t, "/v1/charge", r.URL.Path)
        assert.Equal(t, "Bearer test-key", r.Header.Get("Authorization"))
        w.WriteHeader(http.StatusOK)
        w.Write([]byte(`{"status": "success"}`))
    }))
    defer server.Close()

    client := NewPaymentClient(server.URL, "test-key")
    err := client.Charge(ctx, "card_123", 9999)
    
    require.NoError(t, err)
}
```

---

## 🔥 Реальные боевые кейсы

- **Тестирование middleware chain**: `httptest.NewRecorder()` + обёртка middleware + проверка headers
- **Мокинг Redis**: интерфейс `Cacher` с методами `Get/Set/Del` — тест без реального Redis
- **Clock injection**: сервис проверки срока действия токенов — тест "замораживает" время
- **WireMock/httptest для внешних API**: не стучимся в Stripe/Twilio из unit тестов

---

## 💬 Как отвечать на интервью

> "Мокинг в Go строится на интерфейсах — принцип 'accept interfaces, return structs' делает любой код тестируемым. Для простых случаев пишу manual mock с spy-полями (счётчик вызовов). Для больших кодовых баз — mockery генерирует моки из интерфейсов. httptest.NewRecorder — для handler тестов, httptest.NewServer — для тестирования HTTP клиентов. Time инжектирую через func() time.Time — zero-dependency подход."

---

## ❓ Вопросы для интервью (Senior/Staff)

### Когда НЕ нужен мок?

Не мокируй то, чем владеешь (own). Не мокируй `database/sql` напрямую — используй Testcontainers с реальным Postgres. Мокируй только то, что находится за границами твоего кода: внешние API, email/SMS сервисы, сторонние библиотеки с состоянием.

### Как тестировать Goroutine-based код?

Передавай каналы или callbacks в функцию. Используй `sync.WaitGroup` внутри теста. Запускай с `-race` флагом. Для долгих операций — inject ticker/timer-интерфейс.

```go
type Ticker interface {
    C() <-chan time.Time
    Stop()
}
// В prod: time.NewTicker() обёртка, в тесте: fake ticker с ручным контролем
```

### Чем отличается Stub, Mock, Fake, Spy?

| Тип | Суть |
|-----|------|
| **Stub** | Возвращает заготовленные ответы, не проверяет вызовы |
| **Mock** | Проверяет что методы вызывались (с правильными аргументами) |
| **Fake** | Рабочая, но упрощённая реализация (in-memory DB) |
| **Spy** | Реальная реализация + запись вызовов для assertions |

---

## 📊 Итоговая шпаргалка

| Инструмент | Когда использовать |
|------------|-------------------|
| Manual mock | Простые интерфейсы, < 5 методов |
| mockery/gomock | Большие интерфейсы, много тестов |
| httptest.Recorder | Тестирование HTTP handlers |
| httptest.Server | Тестирование HTTP clients |
| Testcontainers | Real DB/Redis интеграционные тесты |
| Clock injection | Любой код с time.Now() |
