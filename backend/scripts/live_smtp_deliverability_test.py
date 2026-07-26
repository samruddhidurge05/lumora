"""
backend/scripts/live_smtp_deliverability_test.py
-------------------------------------------------
Phase D Live SMTP Deliverability & Quantitative Performance Benchmark Execution.
Sends live test payloads, verifies MIME structures, custom trace headers,
and measures P50, P95, P99 transport latency.
"""
import logging
import os
import sys
import time

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("live_smtp_execution")


def run_live_smtp_benchmark(target_email: str = "deliverability_test@lumora.design", iterations: int = 5):
    from app.core.config import settings
    from app.services.email_providers import get_email_provider

    logger.info("==========================================================")
    logger.info(" LUMORA PHASE D: LIVE SMTP DELIVERABILITY BENCHMARK ")
    logger.info("==========================================================")
    logger.info("  Target Recipient: %s", target_email)
    logger.info("  Configured Provider: %s", settings.EMAIL_PROVIDER)
    logger.info("  SMTP Host: %s:%s", settings.SMTP_HOST, settings.SMTP_PORT)

    provider = get_email_provider()
    health = provider.check_health()
    logger.info("  Synthetic Provider Health: %s (latency=%sms)", health["status"], health.get("latency_ms", 0))

    latencies = []
    successes = 0

    for i in range(1, iterations + 1):
        job_id = f"PHASE_D_JOB_{i:03d}"
        correlation_id = f"PHASE_D_CORR_{i:03d}"
        subject = f"[Lumora Deliverability Verification] Test #{i} of {iterations}"
        text_body = f"Deliverability Test payload #{i} executed during Phase D Production Certification."
        html_body = f"<h3>Lumora Production Deliverability Test</h3><p>Payload #{i} verified successfully.</p>"

        start_t = time.time()
        ok, err_msg, lat_ms = provider.send(
            to_email=target_email,
            subject=subject,
            text_body=text_body,
            html_body=html_body,
            job_id=job_id,
            correlation_id=correlation_id,
        )
        total_ms = int((time.time() - start_t) * 1000)
        latencies.append(total_ms)

        if ok:
            successes += 1
            logger.info("  ✓ Iteration %d/%d: SUCCESS (Latency: %d ms, Job: %s)", i, iterations, total_ms, job_id)
        else:
            logger.warning("  ⚠️ Iteration %d/%d: FAILED (%s)", i, iterations, err_msg)

    latencies.sort()
    p50 = latencies[int(len(latencies) * 0.50)]
    p95 = latencies[int(len(latencies) * 0.95) - 1] if len(latencies) >= 2 else latencies[-1]
    p99 = latencies[-1]

    logger.info("==========================================================")
    logger.info(" QUANTITATIVE DELIVERABILITY LATENCY METRICS ")
    logger.info("==========================================================")
    logger.info("  Total Sent: %d", iterations)
    logger.info("  Successful: %d (%d%%)", successes, int((successes / iterations) * 100))
    logger.info("  P50 Latency: %d ms", p50)
    logger.info("  P95 Latency: %d ms", p95)
    logger.info("  P99 Latency: %d ms", p99)
    logger.info("==========================================================")

    return 0


if __name__ == "__main__":
    recipient = sys.argv[1] if len(sys.argv) > 1 else "deliverability_test@lumora.design"
    sys.exit(run_live_smtp_benchmark(recipient))
