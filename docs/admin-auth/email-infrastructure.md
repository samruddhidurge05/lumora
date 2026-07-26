# Lumora Production Email Infrastructure

## Component Architecture

```
+---------------------+
|  FastAPI Handler    |
| (invite / resend)   |
+---------------------+
           |
           v
+---------------------+
|   EmailDispatcher   |  (Thread Pool Execution / Async Queue Interface)
+---------------------+
           |
           v
+---------------------+
| send_invitation_    |
|       email         |
+---------------------+
           |
           v
+---------------------+
| _send_raw_with_     |  (Exponential Backoff: 2s, 4s, 8s + Jitter)
|       retry         |
+---------------------+
           |
           v
+---------------------+
|  Gmail / SMTP Host  |
+---------------------+
```

---

## Core Infrastructure Features

1. **`EmailDispatcher` Abstraction**: Encapsulates background execution. Swap background threads for Celery, RQ, or Dramatiq without altering route logic.
2. **Exponential Backoff**: Up to 3 retries on transient connection or socket errors with random jitter.
3. **Structured JSON Logging**: Outputs `job_id`, `correlation_id`, `invitation_id`, `recipient`, `latency_ms`, `attempt`, and `provider`.
4. **Resend Cooldown Guard**: Enforces a 60-second idempotency window returning `HTTP 429`.
5. **Startup Readiness Check**: Performs boot-time connection handshake logging readiness status.
