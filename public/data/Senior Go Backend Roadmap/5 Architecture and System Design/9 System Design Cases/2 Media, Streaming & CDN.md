# 🏗️ System Design Cases: Media, Streaming & CDN

---

## 📌 Case 4: YouTube / Netflix Video Streaming

### Requirements
- Upload: 500 hours of video per minute
- Stream: billions of views, adaptive bitrate
- Global, low latency

### Upload & Processing Pipeline

```
User → Upload Service → Object Store (S3 raw) → Message Queue (Kafka)
                                                        ↓
                                              Transcoding Workers
                                              (FFmpeg в Kubernetes Pods)
                                                        ↓
                              [1080p] [720p] [480p] [360p] → S3 processed
                                                        ↓
                                              Metadata DB (updated)
                                              CDN (pre-warmed for popular)
```

### Adaptive Bitrate Streaming (HLS/DASH)

```
Видео разбито на chunks по 2-10 секунд
Плеер получает .m3u8 манифест с URLs для каждого качества
На основе bandwidth → выбирает подходящий chunk

HLS (Apple): .m3u8 manifest + .ts chunks
DASH (Google): .mpd manifest + .mp4 segments

Алгоритм ABR:
- Измеряем download speed последнего chunk
- Если скорость > threshold → upgrade quality
- Если буфер < 10s → downgrade quality
```

### Storage Strategy

```
Hot content (вышло < 7 дней):
→ Кэшируется на Edge CDN nodes (100% hit rate для топ контента)

Warm content (7 дней - 1 год):
→ Regional CDN, cache на 70% запросов

Cold content (> 1 год, редко смотрят):
→ S3 Glacier / Coldline (дешёвое хранение)
→ При запросе → restore за несколько секунд

Дедупликация:
→ Хэш видео при upload → если уже есть, храним один файл
→ Разные пользователи загружают одно и то же → экономия
```

### Interview Answer
> "Upload flow: chunked upload в S3 → Kafka event → transcoding workers делают FFmpeg в K8s batch jobs. Храним 5 качеств. CDN Pre-warm для trending контента через ML prediction (если видео набирает 1M просмотров за час — pre-push на edge). HLS манифест отдаётся через CDN. Metadata в PostgreSQL + Elasticsearch для поиска."

---

## 📌 Case 5: TikTok / Short Video Platform

### Отличия от YouTube
- Короткие видео (15s-3min) → меньший chunk, быстрее transcoding
- "For You" feed — ML рекомендации, не subscriptions
- Infinite scroll → непрерывная загрузка

### For You Feed (Recommendation)

```
При скролле:
1. Client запрашивает следующие N видео
2. Feed Service → Recommendation Engine
3. Recommendation Engine:
   a. Candidate Generation: взять топ-1000 кандидатов
      (популярные в регионе + похожие на лайкнутые)
   b. Ranking Model: ML score для каждого кандидата
      (watch time prediction, like probability)
   c. Filter: убрать уже просмотренные + duplicates
   d. Return top 20

User signals → Kafka → Feature Store → Model re-training (daily)
```

### Interview Answer
> "For You Page — two-stage recommendation: candidate retrieval (ANN vector search в Milvus/Pinecone) + ranking model (LightGBM или neural). Сигналы: watch time > 80% = strong positive, swipe away < 3s = negative. Signals → Kafka → Feature Store. Pre-generate feed для active users фоново чтобы minimize P99 latency при скролле."

---

## 📌 Case 6: Zoom / Video Conferencing (SFU vs MCU)

### SFU vs MCU

```
MCU (Multipoint Control Unit):
- Сервер МИКШИРУЕТ все streams в один
- Клиент получает один смешанный поток
- Плюс: клиент нагружен минимально (один decode)
- Минус: сервер CPU интенсивный (encode N×N streams)
- Использование: старые системы, low-end devices

SFU (Selective Forwarding Unit):
- Сервер только ФОРВАРДИТ потоки (не декодирует/микширует)
- Каждый клиент получает все streams отдельно
- Плюс: сервер легковесный, масштабируется
- Минус: клиент нагружен (decode N streams)
- Использование: Zoom, Google Meet, Discord

Почему SFU лучше для масштаба:
→ SFU сервер: forward 1Gbps трафик, CPU низкий
→ MCU сервер: decode + mix + encode → CPU очень высокий
→ При 50 участниках MCU = 50 × encode = невозможно
```

### WebRTC Stack

```
Signaling (WebSocket): обмен SDP (Session Description Protocol)
  - "Я поддерживаю H.264 и VP8"
  - "Мой ICE candidate: 192.168.1.1:5004"

ICE (Interactive Connectivity Establishment):
  - Нахождение пути между клиентами через NAT
  - STUN: клиент узнаёт свой публичный IP
  - TURN: relay сервер когда прямое соединение невозможно

Media: SRTP (Secure Real-time Transport Protocol)
  - UDP-based (не TCP — потеря пакета лучше задержки для видео!)
  - RTCP: feedback (quality, packet loss reports)

Simulcast:
  - Клиент отправляет 3 quality streams (high/med/low)
  - SFU выбирает нужное качество для каждого получателя
  - Slow connection participant → получает низкое качество
```

### Interview Answer
> "SFU архитектура: медиасервер только форвардит пакеты без декодирования. Используем simulcast — клиент шлёт 3 варианта качества, SFU выбирает исходя из bandwidth получателя. WebRTC через UDP. Для масштаба: каждый SFU Pod обслуживает N rooms, гео-близкий датацентр выбирается через Anycast DNS. Recording Service получает stream от SFU и пишет в S3."

---

## 📌 Case 7: CDN Design

### Архитектура

```
User DNS Query → GSLB (Global Server Load Balancer)
  → возвращает IP ближайшего Edge Server
  → на основе: геолокация + нагрузка + health

Cache Hit on Edge:
User → Edge Server: "Дай /image/cat.jpg" → Cache Hit → return (< 5ms)

Cache Miss on Edge:
User → Edge Server → Origin Server → return → cache on Edge → return to User
(TTL определяется Cache-Control headers от Origin)
```

### Push vs Pull CDN Models

```
Pull (Lazy):
- Контент попадает на Edge при первом запросе (cache miss)
- Плюс: только нужный контент кэшируется
- Минус: первый пользователь в регионе платит latency penalty
- Использование: Cloudflare, большинство General Purpose CDN

Push (Eager):
- Контент публикуется → сразу pushается на все Edge nodes
- Плюс: нет cache miss
- Минус: нужно управлять распространением, расход storage
- Использование: Netflix (pre-push популярный контент на Edge ночью)

Гибрид: Push для top-100 контента (предсказывается ML), Pull для остального
```

### Cache Invalidation

```
TTL-based: Content-Control: max-age=86400 (простой, eventual consistency)
Versioning: /static/app.v3.js (deploy = новый URL, старый остаётся)
Purge API: CDN API вызов → немедленная инвалидация по URL или тегу
  Cloudflare: POST /zones/{id}/purge_cache {"files": ["url1", "url2"]}
```

### Interview Answer
> "Pull CDN для динамического контента — cache miss на Edge, запрос к Origin, TTL-based expiry. Push CDN для статики и популярного видео — pre-push ночью когда трафик низкий. GSLB через Anycast DNS — клиент роутится к ближайшему POP (Point of Presence). Cache invalidation: versioned URLs для static assets, Purge API для критических обновлений (например, GDPR deletion request)."

---

## 📊 Key Numbers

| Система | Latency target | Storage scale |
|---------|---------------|---------------|
| Video streaming | < 2s start time | Petabytes |
| Video conferencing | < 150ms audio | GB/room/hour |
| CDN edge cache | < 5ms | TBs per PoP |
