"""Rahmat loyalty/cashback integration scaffold.

Rahmat is part of the Payme ecosystem. Real credentials are not yet available.
All transactional methods raise NotImplementedError until credentials are provided.
Config shape:
  merchant_token  — secret, encrypted at rest
  secret          — secret, encrypted at rest
  cashback_rate   — public float, cashback percentage (default 1.0 %)
  sandbox         — bool (default True)
"""
from __future__ import annotations

import logging

from app.modules.integration.base import ScaffoldIntegrationBase

log = logging.getLogger(__name__)


class RahmatService(ScaffoldIntegrationBase):
    code = "rahmat"
    name = "Rahmat"
    category = "payment"
    description = "Rahmat cashback/loyalty tizimi (Payme ekosistemasi)"
    credentials_required = True

    def _secret_fields(self) -> list[str]:
        return ["merchant_token", "secret"]

    def _required_fields(self) -> list[str]:
        return ["merchant_token", "secret"]

    async def test_connection(self) -> dict:
        cfg = await self.get_raw_config()
        if not cfg.get("merchant_token"):
            return {
                "ok": False,
                "message": "merchant_token sozlanmagan",
                "latency_ms": None,
                "stubbed": True,
            }
        return {
            "ok": False,
            "message": "Konfig to'g'ri (stub) — real credentials kerak",
            "latency_ms": None,
            "stubbed": True,
        }

    async def register_transaction(
        self,
        sale_id: str,
        amount: float,
        phone: str | None = None,
    ) -> dict:
        raise NotImplementedError(
            "Rahmat register_transaction — real credentials required"
        )

    async def handle_webhook(self, payload: dict) -> dict:
        """
        Stub webhook handler. Returns stubbed=True so the caller can detect
        scaffold mode and log without crashing.
        """
        log.info("Rahmat webhook received (stub): %s", payload)
        return {"ok": True, "stubbed": True}
