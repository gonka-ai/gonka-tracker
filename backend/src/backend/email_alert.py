import smtplib
import os
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
import asyncio

logger = logging.getLogger(__name__)


class EmailAlert:
    def __init__(self):
        self.smtp_host = os.getenv("SMTP_HOST", "")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_user = os.getenv("SMTP_USER", "")
        self.smtp_password = os.getenv("SMTP_PASSWORD", "")
        self.alert_email = os.getenv("ALERT_EMAIL", "maria.mitina@productscience.ai")
        self.from_email = os.getenv("SMTP_FROM_EMAIL", self.smtp_user)
        self.enabled = bool(self.smtp_host and self.smtp_user and self.smtp_password)
        
        if not self.enabled:
            logger.warning("Email alerts disabled: missing SMTP configuration")
    
    async def send_alert(self, subject: str, message: str) -> bool:
        if not self.enabled:
            logger.debug("Email alerts disabled, skipping")
            return False
        
        try:
            await asyncio.to_thread(self._send_sync, subject, message)
            logger.info(f"Sent email alert: {subject}")
            return True
        except Exception as e:
            logger.error(f"Failed to send email alert: {e}")
            return False
    
    def _send_sync(self, subject: str, message: str):
        msg = MIMEMultipart()
        msg["From"] = self.from_email
        msg["To"] = self.alert_email
        msg["Subject"] = subject
        
        msg.attach(MIMEText(message, "plain"))
        
        with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
            server.starttls()
            server.login(self.smtp_user, self.smtp_password)
            server.send_message(msg)
