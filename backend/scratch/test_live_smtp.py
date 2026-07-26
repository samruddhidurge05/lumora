"""
backend/scratch/test_live_smtp.py
---------------------------------
Diagnostic script testing newly generated App Password for durgesamruddhi@gmail.com.
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
to_email = os.getenv("TEST_RECIPIENT_EMAIL", smtp_user)

print("=== TESTING NEW GMAIL APP PASSWORD ===")
print(f"Connecting to {smtp_host}:{smtp_port} ...")
print(f"User: {smtp_user}")
print(f"Password: {smtp_password[:4]}****{smtp_password[-4:]}")

try:
    start_time = time.time()
    with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
        print("[1/4] EHLO ...")
        server.ehlo()
        print("[2/4] STARTTLS ...")
        server.starttls()
        server.ehlo()
        print("[3/4] Authenticating with Gmail SMTP ...")
        login_res = server.login(smtp_user, smtp_password)
        print(f"      [LOGIN SUCCESS]: {login_res}")

        print("[4/4] Sending test message via sendmail ...")
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Lumora Live SMTP Invitation Verification Test"
        msg["From"] = f"Lumora Admin <{smtp_from}>"
        msg["To"] = to_email
        msg.attach(MIMEText("This is a live SMTP authentication test.", "plain"))
        msg.attach(MIMEText("<h2>Lumora SMTP Test</h2><p>Live authentication succeeded!</p>", "html"))

        send_res = server.sendmail(smtp_from, [to_email], msg.as_string())
        print(f"      [SENDMAIL SUCCESS]: {send_res}")

    latency = int((time.time() - start_time) * 1000)
    print(f"\nSUCCESS! Gmail SMTP Authenticated & Delivered Email to {to_email} in {latency}ms!")
except Exception as exc:
    print(f"\nFAILED ({type(exc).__name__}): {exc}")
    sys.exit(1)
