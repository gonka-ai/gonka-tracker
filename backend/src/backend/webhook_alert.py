import httpx
import os
import logging
from typing import Optional, List
import json

logger = logging.getLogger(__name__)


class WebhookAlert:
    def __init__(self):
        webhook_urls = os.getenv("WEBHOOK_URLS", "")
        self.webhook_urls = [url.strip() for url in webhook_urls.split(",") if url.strip()]
        self.enabled = len(self.webhook_urls) > 0
        
        if not self.enabled:
            logger.warning("Webhook alerts disabled: no WEBHOOK_URLS configured")
        else:
            logger.info(f"Webhook alerts enabled: {len(self.webhook_urls)} webhook(s) configured")
    
    async def send_alert(self, subject: str, message: str) -> bool:
        if not self.enabled:
            logger.debug("Webhook alerts disabled, skipping")
            return False
        
        success_count = 0
        for webhook_url in self.webhook_urls:
            try:
                await self._send_to_webhook(webhook_url, subject, message)
                success_count += 1
            except Exception as e:
                logger.error(f"Failed to send webhook alert to {webhook_url}: {e}")
        
        if success_count > 0:
            logger.info(f"Sent webhook alert to {success_count}/{len(self.webhook_urls)} webhook(s): {subject}")
            return True
        
        return False
    
    async def _send_to_webhook(self, webhook_url: str, subject: str, message: str):
        payload = self._format_payload(webhook_url, subject, message)
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                webhook_url,
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            response.raise_for_status()
    
    def _format_payload(self, webhook_url: str, subject: str, message: str) -> dict:
        if "hooks.slack.com" in webhook_url:
            return {
                "text": f"*{subject}*\n{message}"
            }
        elif "discord.com" in webhook_url or "discordapp.com" in webhook_url:
            return {
                "content": f"**{subject}**\n{message}"
            }
        else:
            return {
                "subject": subject,
                "message": message,
                "text": f"{subject}\n\n{message}"
            }
