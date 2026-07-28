"""
backend/scratch/audit_delivery_final.py
---------------------------------------
End-to-end forensic SMTP transcript and delivery audit script.
"""
import os
import smtplib
import sys
import time
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
smtp_port = int(os.getenv("SMTP_PORT", "587"))
smtp_user = os.getenv("SMTP_USER", "durgesamruddhi@gmail.com")
raw_pwd = os.getenv("SMTP_PASSWORD", "niog ecxh xcec dacl")
smtp_password = raw_pwd.replace(" ", "").strip()
smtp_from = os.getenv("SMTP_FROM", smtp_user)
to_email = os.getenv("TEST_RECIPIENT_EMAIL", "durgesamruddhi@gmail.com")

print("================================================================================")
print("FINAL END-TO-END SMTP DELIVERY FORENSIC TRANSCRIPT")
print("================================================================================")
print(f"Target Host:       {smtp_host}:{smtp_port}")
print(f"Authenticated User: {smtp_user}")
print(f"Sender (MAIL FROM): {smtp_from}")
print(f"Recipient (RCPT TO): {to_email}")
print("--------------------------------------------------------------------------------")

start_time = time.time()
try:
    # Enable debug output level 1 to capture the raw SMTP transcript
    server = smtplib.SMTP(smtp_host, smtp_port, timeout=15)
    server.set_debuglevel(1)

    print("\n--- [SMTP TRANSCRIPT START] ---")
    server.ehlo()
    server.starttls()
    server.ehlo()
    login_code, login_msg = server.login(smtp_user, smtp_password)

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Lumora Final End-to-End Delivery Forensic Verification"
    msg["From"] = f"Lumora Admin <{smtp_from}>"
    msg["To"] = to_email
    msg["Reply-To"] = "support@lumora.design"
    msg["X-Lumora-Job-ID"] = "job_audit_final_001"
    msg["X-Lumora-Correlation-ID"] = "corr_audit_final_001"

    text = "Lumora Final Delivery Audit.\nAcceptance Verification Code: 250 OK."
    html = """<!DOCTYPE html>
    <html>
      <body style="font-family: sans-serif; padding: 20px;">
        <h2 style="color: #7B3FA0;">Lumora Admin Invitation Final Delivery Test</h2>
        <p>This is a live forensic SMTP transcript verification email.</p>
        <p><strong>Status:</strong> 250 OK Message Accepted for Delivery.</p>
      </body>
    </html>"""
    msg.attach(MIMEText(text, "plain"))
    msg.attach(MIMEText(html, "html"))

    # Sendmail
    send_errors = server.sendmail(smtp_from, [to_email], msg.as_string())
    server.quit()
    print("--- [SMTP TRANSCRIPT END] ---\n")

    latency_ms = int((time.time() - start_time) * 1000)

    print("================================================================================")
    print("TRANSCRIPT AUDIT RESULTS:")
    print(f"1. Login Status Code:      {login_code} ({login_msg.decode('utf-8', errors='ignore')})")
    print(f"2. Sendmail Response:        {send_errors} (Empty dict = 100% Accepted)")
    print(f"3. Total Latency:            {latency_ms}ms")
    print("================================================================================")

except Exception as exc:
    print(f"\nFAILED ({type(exc).__name__}): {exc}")
    sys.exit(1)
