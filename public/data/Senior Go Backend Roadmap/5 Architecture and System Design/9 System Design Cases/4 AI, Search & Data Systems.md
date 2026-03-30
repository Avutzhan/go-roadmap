# 🏗️ System Design Cases: AI, Search & Data Systems

---

## 📌 Case 11: ChatGPT-style LLM Service

### Requirements
- Streaming token-by-token response (SSE)
- Multi-turn conversation (context)
- High latency tolerance (10-60s для генерации)

### Architecture

```
Client → API Gateway → Auth → Inference Gateway
                                     ↓
                          Session Service (Redis)
                          загружает историю разговора
                                     ↓
                          LLM Worker Pool (GPU instances)
                          модель генерирует tokens
                                     ↓
                          SSE stream обратно клиенту (token by token)
```

### Streaming (Server-Sent Events)

```go
// Go SSE handler
func chatHandler(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "text/event-stream")
    w.Header().Set("Cache-Control", "no-cache")
    flusher := w.(http.Flusher)

    tokenCh := inferenceService.Generate(r.Context(), prompt)
    for token := range tokenCh {
        fmt.Fprintf(w, "data: %s\n\n", token)
        flusher.Flush()
    }
    fmt.Fprintf(w, "data: [DONE]\n\n")
}
```

### Context Window Management

```
Проблема: GPT-4 = 128K tokens context limit
Длинная история разговора → превышает лимит

Стратегии:
1. Sliding Window: оставляем последние N сообщений
2. Summarization: старые сообщения → краткое summary через отдельный LLM call
3. RAG (Retrieval-Augmented Generation):
   - История → embeddings → Vector DB (Pinecone/Milvus)
   - При новом запросе → найти релевантные chunks → добавить в context

Session Storage:
→ Redis: последние 20 сообщений (active session)
→ PostgreSQL: полная история (для восстановления)
```

### GPU Batching

```
Проблема: GPU дорогой, inference занимает всё время GPU для одного запроса

Continuous Batching (vLLM):
→ Разные пользователи → batched вместе на одном GPU
→ Один запрос завершился → слот освобождается, добавляем новый
→ Utilization GPU: от 30% → 80%+

KV Cache (Key-Value Cache):
→ Повторяющийся system prompt (инструкции) не пересчитывается
→ Pre-computed и кэшируется между запросами
```

### Interview Answer
> "Inference Gateway → LLM Worker Pool (GPU K8s nodes). SSE для streaming: клиент получает токены немедленно, perceived latency низкий. Context: последние 20 messages в Redis, старые — summarize + RAG. Horizontal scaling LLM workers через K8s HPA (по GPU utilization). Rate limiting per user: token bucket в Redis."

---

## 📌 Case 12: AI Customer Support Platform

### Architecture

```
User Message → Router/Orchestrator LLM
                ↓
    Классификация intent:
    - Billing? → Billing Agent
    - Technical? → Tech Support Agent
    - General? → General Agent
                ↓
    Agent calls Tools (функции):
    - get_order_status(order_id)
    - check_account_balance(user_id)
    - create_ticket(description)
                ↓
    Если confidence < threshold → Escalation → Human Agent
```

### Confidence & Escalation

```
Каждый агент возвращает {answer, confidence_score}
confidence < 0.7 → "let me connect you to human agent"

Human-in-the-loop queue:
→ Redis queue с приоритизацией (VIP customers first)
→ Human agent видит полный контекст разговора
→ After resolution → agent learns from human correction
```

---

## 📌 Case 13: Web Crawler

### Requirements
- Обходить миллиарды URL
- Respectful (robots.txt, politeness delay)
- Дедупликация страниц

### Architecture

```
[Seed URLs] → URL Frontier (Priority Queue)
                     ↓
              URL Scheduler (Politeness: 1 req/s per domain)
                     ↓
              HTML Downloader (distributed workers)
                     ↓
     ┌──────────────┤
     ↓              ↓
Link Extractor   Content Processor
     ↓              ↓
New URLs →      Content Store (deduplicated)
Bloom Filter    
check (seen?)   
     ↓
URL Frontier
```

### Key Data Structures

```
URL Frontier: Priority Queue (приоритет = PageRank + freshness)
              Partitioned по domain для politeness

Bloom Filter: "Was this URL visited?"
→ Storing 10B URLs in Bloom Filter: ~10B × 10 bits = 10GB (vs 300GB в hashset)
→ False positive rate ~1% → acceptable (пропустим 1% новых URL)

Content Dedup:
→ SimHash: похожие страницы имеют похожий hash
→ URL 1 и URL 2 имеют SimHash distance < threshold → дубликат

DNS Cache:
→ Каждый URL → DNS lookup → кэшровать на 1 час
→ Без кэша: 10K crawls/sec = 10K DNS queries/sec → rate limit
```

### Interview Answer
> "URL Frontier — partitioned priority queue по domain (politeness: max 1 req/s per domain). Bloom Filter для 10B visited URLs (10GB RAM vs 300GB в hashset, 1% false positive OK). SimHash для контентной дедупликации — страницы с > 90% схожестью = дубликаты. Scalability: 1000 worker goroutines, каждый обрабатывает свою partition frontier."

---

## 📌 Case 14: Google Drive / Dropbox (File Sync)

### Block-based Storage

```
Файл разбивается на blocks (chunks) по 4MB
Каждый block → SHA-256 хэш = block ID
Хранится в Object Store (S3) под key = block_id

Преимущества:
1. Дедупликация: одинаковые blocks у разных файлов → один физический block
2. Partial upload: при обрыве → докачать только оставшиеся blocks
3. Delta sync: изменился 1MB в середине файла → загружаем только 1 block

File metadata в PostgreSQL:
→ file_id, name, user_id, blocks: [block1_id, block2_id, ...]
→ Versioning: каждая версия = новый snapshot blocks list
```

### Sync Protocol

```
Client A изменяет файл:
1. Вычислить diff (какие blocks изменились)
2. Upload только изменённые blocks в S3
3. Update metadata в Metadata Service
4. Metadata Service → Kafka event "file_updated"

Client B (другое устройство):
1. Notification Service (WebSocket или long-polling) → уведомление
2. Client B запрашивает новую metadata
3. Скачивает только изменённые blocks (diff)
```

### Interview Answer
> "Block-based: файл → chunks 4MB → SHA-256 → S3. Delta sync: только изменённые chunks загружаются. Metadata в PostgreSQL с версионированием. При изменении → Kafka event → Notification Service → WebSocket push к другим устройствам. Conflict resolution: last-write-wins или создание conflict copy (как Dropbox делает)."

---

## 📌 Case 15: Recommendation Engine

### Two-Stage Architecture

```
Stage 1: Candidate Retrieval (сотни/тысячи кандидатов)
→ Matrix Factorization: user_embedding × item_embedding = relevance score
→ ANN search (Approximate Nearest Neighbor) в Vector DB
→ Fast: O(log n), но менее точный

Stage 2: Ranking (точная оценка топ кандидатов)
→ LightGBM / Neural Network
→ Features: user history, item features, context (time, device)
→ Score → sort → top-N

Cold Start Problem:
→ Новый пользователь: нет истории → показываем trending/popular
→ Новый item: нет interactions → Content-based (метаданные: жанр, теги)
→ После 10 interactions → hybrid (collaborative + content)
```

### Interview Answer
> "Two-stage: candidate retrieval через embedding similarity (ANN в Pinecone/Faiss, ~1ms) + full ranking model (LightGBM, ~10ms для 1000 кандидатов). Features: user watch history (последние 50 items encoded), item metadata, temporal features (weekday, hour). Cold start: popularity-based fallback. Model retrain ежедневно на следующий день сигналов через Spark."

---

## 📊 AI/Data Systems Summary

| Система | Latency | Scale | Key Tech |
|---------|---------|-------|---------|
| LLM Service | 1-60s (stream) | 1M users | GPU cluster, vLLM, SSE |
| Recommendation | < 50ms | 100M users | ANN, LightGBM, Feature Store |
| Web Crawler | Throughput | 1B URLs | Bloom Filter, URL Frontier |
| File Sync | Near real-time | PB storage | Block store, Delta sync |
