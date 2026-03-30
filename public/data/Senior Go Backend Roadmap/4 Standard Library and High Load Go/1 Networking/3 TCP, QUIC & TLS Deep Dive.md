# 🧠 TCP, QUIC/HTTP3 & TLS Deep Dive

## 📌 Что это такое

Для Senior Go-инженера понимание сетевого стека — это умение правильно настроить `http.Transport`, объяснить почему QUIC заменяет TCP, и понять где сеть является bottleneck.

---

## 🔬 TCP: ключевые концепции

### 3-way Handshake & 4-way Close

```
Установка соединения:
Client → [SYN]                     → Server
Client ← [SYN-ACK]                 ← Server
Client → [ACK]                     → Server
─── соединение установлено ───

Закрытие (4-way):
Client → [FIN]   → Server  (я закончил отправку)
Client ← [ACK]   ← Server  (принял)
Client ← [FIN]   ← Server  (я тоже закончил)
Client → [ACK]   → Server  (принял)
─── соединение закрыто ───

TIME_WAIT: клиент ждёт 2*MSL (~2 мин) перед полным закрытием
→ Если у вас тысячи short-lived connections → TIME_WAIT накапливается
→ Решение: connection pooling, keep-alive, SO_REUSEPORT
```

### Window Size & Congestion Control

```
Window Size: сколько байт можно отправить без ACK
→ Маленький window → throughput ограничен, даже при быстром канале
→ Go http.Transport: tcp_noDelay, buffer sizes

Congestion Control:
- CUBIC (default Linux): быстро наращивает window, сбрасывает при loss
- BBR (Google): оценка bandwidth напрямую, лучше при high latency
```

### HTTP/1.1 vs HTTP/2 vs HTTP/3 (QUIC)

```
HTTP/1.1:
- 1 запрос/соединение (или keep-alive с pipelining)
- Head-of-line blocking (HOL): если запрос 1 медленный → запрос 2 ждёт
- Текстовые headers в каждом запросе (дублирование)

HTTP/2:
- Multiplexing: много потоков в одном TCP соединении
- Binary protocol (не текст)
- HPACK: сжатие заголовков (delta compression)
- ⚠️ TCP-level HOL blocking остаётся! (потеря пакета блокирует все потоки)

HTTP/3 (QUIC):
- UDP вместо TCP  
- Каждый поток независим на уровне транспорта → потеря пакета влияет только на свой поток
- Встроенный TLS 1.3 (0-RTT handshake)
- Connection migration: смена IP/Wi-Fi → соединение не разрывается
```

```go
// HTTP/2 в Go — автоматически при TLS
server := &http.Server{
    TLSConfig: &tls.Config{NextProtos: []string{"h2", "http/1.1"}},
}

// HTTP/3 через quic-go
import "github.com/quic-go/quic-go/http3"
server := http3.Server{
    Handler: mux,
    Addr:    ":443",
}
```

---

## 🔬 TLS Handshake

```
TLS 1.3 (современный):
1. Client Hello: поддерживаемые ciphers, key exchange parameters
2. Server Hello: выбранный cipher, certificate, подпись
3. Client Finished: encrypted handshake data
─── 1 RTT (vs 2 RTT в TLS 1.2) ───

0-RTT (Session Resumption):
- Клиент знает pre-shared key от прошлого соединения
- Посылает данные сразу с первым пакетом
- ⚠️ Replay attack риск — только для idempotent GET запросов

PKI (Public Key Infrastructure):
Browser ← Certificate ← CA (Certificate Authority)
Браузер проверяет: chain of trust до trusted root CA
Certificate содержит: public key, domain, expiry, CA signature

mTLS (Mutual TLS):
- Обе стороны проверяют сертификаты друг друга
- server cert: server → client
- client cert: client → server
- Используется в Service Mesh (Istio/Linkerd) для service identity
```

---

## 🔬 DNS Internals

```
Recursive vs Iterative resolution:

Recursive (что делает ваш OS):
Client → [Recursive Resolver] → Root NS → TLD NS → Authoritative NS
         ^ всё делает за вас ^

Iterative (что делает Recursive Resolver):
1. Запрос Root NS: "где .com?" → "вот TLD сервер"
2. Запрос TLD NS: "где example.com?" → "вот Authoritative NS"
3. Запрос Auth NS: "где www.example.com?" → "A 1.2.3.4"

DNS Record Types:
A       → IPv4 address
AAAA    → IPv6 address
CNAME   → Canonical Name (alias)
MX      → Mail Exchange server
TXT     → текст (DKIM, SPF, ACME challenge)
NS      → Name Server для зоны
PTR     → обратный DNS (IP → имя)
SRV     → service location (gRPC service discovery)

TTL: как долго кэшировать ответ
Low TTL (60s) = быстрое переключение при failover
High TTL (3600s) = меньше запросов к DNS (экономия)
```

---

## 🔬 Load Balancing: L4 vs L7

```
L4 (Transport Layer — IP + Port):
- Работает с TCP/UDP потоками
- Не видит HTTP контент
- Очень быстрый (hardware или kernel bypass)
- Алгоритмы: Round Robin, IP Hash (sticky sessions)
- Примеры: AWS NLB, IPVS, HAProxy (TCP mode)

L7 (Application Layer — HTTP):
- Видит URL, headers, cookies
- Может делать routing по path: /api/* → service-a
- SSL termination
- Может делать health check реальных HTTP endpoints
- Алгоритмы: Least Connections, Weighted Round Robin
- Примеры: Nginx, Envoy, Traefik, AWS ALB
```

### Атаки на сетевом уровне

```
SYN Flood (L4):
- Атакующий посылает тысячи SYN без завершения handshake
- Сервер держит half-open connections → исчерпание памяти
- Защита: SYN Cookies (сервер не хранит state до ACK)

DDoS L4: volumetric (bandwidth saturation)
DDoS L7: HTTP flood (simulating legit users)
  → L4 DDoS: mitigation на уровне ISP/CDN (Cloudflare Magic Transit)
  → L7 DDoS: WAF + rate limiting + challenge pages

Man-in-the-Middle:
- Attacker intercepts traffic между client и server
- Защита: TLS (certificate pinning для мобильных приложений)
- HSTS: браузер всегда использует HTTPS для домена
```

---

## 💬 Как отвечать на интервью

> "QUIC решает TCP-level head-of-line blocking: в HTTP/2 потеря одного пакета блокирует все потоки в TCP-соединении. QUIC на UDP делает потоки независимыми. Для Go-сервисов: тюнинг TCP через `http.Transport` — `MaxIdleConns`, `IdleConnTimeout`, `DisableKeepAlives` — критичен под нагрузкой. TLS 1.3 в Go вкючается автоматически, 0-RTT опасен для non-idempotent запросов."

---

## ❓ Вопросы для интервью (Senior/Staff)

### Почему QUIC использует UDP, а не TCP с patch'ами?

TCP — часть OS kernel, его изменение требует обновления всех OS в мире. QUIC implementируется в userspace — Google мог деплоить обновления своим Chrome и серверам без ожидания kernel updates. Это ключевое преимущество: agility.

### Как connection pooling решает проблему TCP overhead?

3-way handshake + TLS handshake = 2-3 RTT накладные расходы на каждое новое соединение. При 100ms RTT = 200-300ms до первого байта данных. Keep-alive + pool = соединение переиспользуется, overhead платим один раз. `http.Transport.MaxIdleConns` и `IdleConnTimeout` — ключевые параметры.

### Что такое Anycast и зачем он нужен CDN?

Несколько серверов в разных точках мира объявляют один и тот же IP prefix через BGP. Пакет роутится к ближайшему (по BGP метрикам). Cloudflare: 1.1.1.1 — Anycast. Ваш DNS-запрос идёт в ближайший data center, не в один central server. Это даёт и low latency и DDoS resilience (трафик распределяется).

---

## 📊 Итоговая шпаргалка

| Концепция | Суть |
|-----------|------|
| TCP HOL Blocking | В HTTP/2: потеря пакета блокирует все потоки |
| QUIC | UDP + TLS 1.3 built-in, независимые потоки |
| TLS 1.3 | 1 RTT handshake, vs 2 RTT в TLS 1.2 |
| mTLS | Взаимная аутентификация (Service Mesh) |
| L4 LB | Быстрый, не видит HTTP content |
| L7 LB | Path routing, SSL termination, health checks |
| SYN Flood | Защита: SYN Cookies |
| DNS TTL | Low = быстрый failover, High = меньше запросов |
