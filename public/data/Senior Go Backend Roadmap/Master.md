# 🗺️ Senior / Tech Lead Go Interview Roadmap v3.0

> 🆕 = добавлено в v3.0

---

## 1. Core Go Fundamentals

### 1.1 Language Basics & Syntax
- Variable Shadowing & Scope
- Constants & iota
- Control Flow & Switch
- Init Functions Execution Order
- Zero Value
- Panic, Closures & Idiomatic Go 🆕

### 1.2 Data Structures Under the Hood
- Slices Internals (header, growth formula)
- Maps Internals (buckets, load factor, evacuation)
- Strings: immutability, byte vs rune

### 1.3 Interfaces & Composition
- Interface Internals (itab, data pointer)
- Embedding & Composition
- Generics

### 1.4 Error Handling
- Error Wrapping: errors.Is, errors.As, %w
- Custom Error Types & Strategy

### 1.5 Safety & Control
- Defer: order, cost, argument evaluation
- Unsafe Package Risks
- Go Modules: MVS, go.sum, govulncheck, go work
- Special & Rare Go Topics (cgo, build tags, internal packages) 🆕
- Go Tooling & Code Quality (go vet, golangci-lint, go doc, coverage, benchstat) 🆕

---

## 2. Concurrency & Parallelism (Deep Level)

### 2.1 Go Runtime & Scheduler
- GMP Architecture (Goroutine, Machine, Processor)
- Work Stealing & Hand-off
- Preemption & Sysmon

### 2.2 Goroutines
- Stack Management (2KB start, dynamic scaling)
- Lifecycle & Leaks

### 2.3 Channels Internals
- hchan Structure (circular buffer, lock, wait queues)
- State & Behavior (nil channel, closed channel)
- Channel Design Patterns

### 2.4 Synchronization Primitives
- Mutex & RWMutex (Writer starvation)
- WaitGroup & Once
- Atomic & Cond

### 2.5 Memory Model & Consistency
- Happens-before & Memory Barriers
- Race Conditions & Detection

### 2.6 Advanced Patterns
- Worker Pool, Fan-in/Fan-out, Pipelines
- Context & errgroup
- Backpressure & Semaphores

### 2.7 Failures & Anti-patterns
- Deadlocks, Livelocks & Starvation
- Graceful Shutdown

---

## 3. Memory & Performance

### 3.1 Allocation & Ownership
- Stack vs Heap
- Escape Analysis
- Zero-copy & String/Byte Conversions

### 3.2 Garbage Collector
- Tri-color Marking Algorithm
- Write Barriers & Latency
- GC Tuning: GOGC & GOMEMLIMIT

### 3.3 Performance Optimization
- sync.Pool Internals
- Memory Alignment & Padding
- Compiler Optimizations (BCE, Inlining)

### 3.4 Profiling & Analysis
- CPU & Heap Profiling (pprof)
- Execution Tracer (go tool trace)
- Benchmarking & benchstat

### 3.5 Scale & OS
- Memory Fragmentation
- Huge Pages & THP

---

## 4. Standard Library & High Load Go

### 4.1 Networking
- HTTP Internals & Connection Pooling
- Keep-alive & Middleware
- TCP, QUIC/HTTP3 & TLS Deep Dive 🆕

### 4.2 Context Deep Dive
- Context Tree & Propagation
- Best Practices & Pitfalls

### 4.3 I/O & Encoding
- io.Reader/Writer & Streams
- JSON & Performance (Reflection vs CodeGen)

### 4.4 Database & Persistence
- database/sql Pool Management
- Transactions & Prepared Statements

### 4.5 Go in Production at Scale
- FD Exhaustion, Goroutine Explosion, Backpressure
- Go in Containers & CPU Throttling (CFS)

---

## 5. Architecture & System Design

### 5.1 Principles & Architecture Styles
- SOLID & Composition in Go
- Design Patterns & Functional Options
- Clean Architecture & DI (Manual vs Wire/Fx)

### 5.2 Distributed Systems
- CAP, PACELC & Consistency Models
- Distributed Transactions: Saga & 2PC
- Idempotency & Quorum

### 5.3 Communication & API Design
- REST vs gRPC vs WebSocket
- API Versioning & Pagination
- Error Modeling

### 5.4 High-Load & Resilience
- Rate Limiting & Load Balancing
- Circuit Breaker & Bulkheads
- Thundering Herd & Singleflight

### 5.5 Security & Observability
- Security Patterns: Zero Trust, mTLS, JWT pitfalls, SLO/Error Budget
- Anti-Abuse, Shadow Traffic, Dead Man's Switch, Safe DB Migrations 🆕

### 5.6 Messaging & Async Patterns
- Kafka vs RabbitMQ
- Message Delivery Guarantees & Outbox Pattern
- Retry, Backoff & DLQ

### 5.7 Advanced Infrastructure
- Distributed Locking: Redis Redlock, etcd Raft
- Service Mesh: Istio VirtualService, Circuit Breaker

### 5.8 Trade-offs & Decision Making
- Trade-off Matrix & One/Two-way Doors
- Strangler Fig Pattern
- Event Sourcing vs CRUD
- CAP в реальных системах

### 5.9 Large-Scale Migrations (Staff Level) 🆕
- Zero-downtime migration & Dual Writes
- Compatibility & Rollout Strategy
- Feature Flags & Data Backfill

---

## 6. Data & Storage

### 6.1 Database Choice
- SQL (PostgreSQL: JSONB, FTS, LTREE) vs NoSQL vs NewSQL
- Cassandra LSM design, ClickHouse OLAP, CockroachDB geo

### 6.2 Indexing & Performance
- B-Tree vs LSM-Tree vs Hash Index
- Composite & Covering Indexes (left-prefix rule)

### 6.3 SQL Deep Level
- Transaction Isolation Levels & MVCC
- Window Functions (ROW_NUMBER, RANK, LAG/LEAD) & Recursive CTEs
- Query Optimization: EXPLAIN ANALYZE, Buffers

### 6.4 Scaling Data
- Replication (sync vs async) & Sharding
- Consistent Hashing & CDC (Debezium)

### 6.5 Caching Deep Dive
- Cache-Aside, Write-Through, Write-Behind
- Cache Stampede (singleflight) & Cache Penetration (Bloom Filter)
- Redis Pipeline, Lua scripting, Cluster vs Sentinel

---

## 7. Coding Interview (Senior Quality)

### 7.1 Linear Patterns
- Two Pointers & Sliding Window
- Linked Lists & Fast-Slow Pointers (Floyd's) 🆕

### 7.2 Non-Linear Patterns
- Trees & Graphs (DFS, BFS, Dijkstra, Topological Sort)
- Heaps & Priority Queues

### 7.3 Advanced & Systemic
- LRU Cache & Trie
- Dynamic Programming (Linear, Knapsack, Interval, State Machine)
- Algorithms Preparation Strategy & Go Specifics 🆕

### 7.4 Senior Coding Quality
- Big O & Amortized Complexity
- Senior Interview Process (Clarify → BruteForce → Optimize → Test)

---

## 8. Production & Debugging

### 8.1 Observability
- Logs, Metrics & Tracing (Zap, Prometheus, OpenTelemetry)
- RED/USE & The Four Golden Signals

### 8.2 Incident & Debugging
- Goroutine Leaks, OOM & Memory Issues
- Deadlocks & Post-mortem Culture

### 8.3 Production Tooling
- pprof & Delve в продакшне
- SLO, Error Budgets, Burn Rate Alerts & Chaos Engineering

### 8.4 Operational Excellence (Staff Level) 🆕
- Advanced SLI/SLO definitions across services
- Org-level Incident Management Process
- On-call culture & Capacity Planning
- Cost vs Performance Trade-offs

---

## 9. Testing & Code Quality

### 9.1 Test Pyramid
- Unit, Integration & E2E Testing (Testcontainers)

### 9.2 Mocking & Doubles
- Manual Mocks, mockery, httptest

### 9.3 Advanced Testing
- Table-driven Tests, Fuzz Testing, Race Detector in CI

### 9.4 Engineering Standards
- Code Review Checklist & ADR

---

## 10. DevOps & Infrastructure Awareness

### 10.1 Containerization
- Docker: Multi-stage builds, Distroless, Security Scanning

### 10.2 Orchestration
- Kubernetes Essentials for Go Devs
- K8s Probes, HPA, PDB & Resource Limits

### 10.3 CI/CD & Delivery
- CI/CD Pipeline & Deployment Strategies (Canary, Blue-Green)

### 10.4 Tools & Git
- Linux CLI & Git Workflows
- Platform Engineering, GitOps (ArgoCD, Flux), IaC (Terraform, Helm) 🆕

---

## 11. Technical Leadership

### 11.1 System Architecture & Strategy
- Architecture Strategy, Design Review & Risk Assessment

### 11.2 Planning & Execution
- Capacity Planning, Tech Debt Quantification ($$$), OKR для инженеров

### 11.3 People & Culture
- Mentoring (leveling framework), SBI Feedback, RACI
- Conflict Resolution & Stakeholder Translation

### 11.4 Execution Under Uncertainty
- One/Two-way Door decisions
- Time-boxed Spikes & Spike-based Estimation

### 11.5 Engineering at Scale
- Conway's Law & Inverse Conway
- Team Topologies (4 типа команд)
- DORA Metrics (Deployment Frequency, MTTR, CFR)

### 11.6 Design Docs / RFC Process (Staff Level) 🆕
- Как писать и структурировать (Context, Alternatives, Solution)
- Как защищать архитектуру
- Как принимать обратную связь

### 11.7 Cross-Team Architecture (Staff Level) 🆕
- Ownership boundaries (граница ответственности)
- Dependency Management на уровне организации
- Integration Contracts & API Governance

### 11.8 Staff Leadership & Influence (Staff Level) 🆕
- Mentoring to Senior level
- Alignment (согласованность направлений)
- Resolving technical disagreement
- Driving technical direction
- Architecture Decision Records (ADR) в масштабе

---

## 12. Behavioral & Storytelling

### 12.1 STAR Method
- STAR Method & Metrics (data-driven answers)

### 12.2 Story Categories
- Technical Stories & Performance
- Crisis, Failure & Learning
- People Leadership & Conflict
- Ready STAR Story Templates (4 шаблона) 🆕
- Amazon Leadership Principles & Killer Questions 🆕

### 12.3 Tips & Principles
- Senior Storytelling Tips (Story Arc, калибровка под аудиторию)

---

## 13. Common Interview Traps & Pitfalls

### 13.1 Technical Traps
- Channels vs Mutex & Overengineering
- Real Interview Scenarios Q&A (memory leak, crashes, 10K rps) 🆕

### 13.2 Logic & Approach Traps
- Premature Scaling, SPOF, System Design Checklist

### 13.3 Real-world Production Traps
- Goroutine Leaks, Timezone UTC, Defer in Loop, Float Money

---

## 📚 Материалы

- `Resources.md` — книги, курсы, mock-interview платформы
- `Plan.md` — план подготовки по неделям

---

## 📊 Статистика v3.0

| Секция | Файлов |
|--------|--------|
| §1 Core Go Fundamentals | 14 |
| §2 Concurrency & Parallelism | 13 |
| §3 Memory & Performance | 11 |
| §4 Standard Library | 9 |
| §5 Architecture & System Design | 14 |
| §6 Data & Storage | 9 |
| §7 Coding Interview | 7 |
| §8 Production & Debugging | 6 |
| §9 Testing & Code Quality | 4 |
| §10 DevOps & Infrastructure | 5 |
| §11 Technical Leadership | 5 |
| §12 Behavioral & Storytelling | 7 |
| §13 Interview Traps | 3 |
| **Итого** | **~107** |
