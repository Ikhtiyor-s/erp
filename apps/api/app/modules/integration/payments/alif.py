"""Alif Bank payment integration — scaffold (T-110).

Real API calls are deferred until Alif merchant credentials are available.
Webhook signature verification is deferred to next sprint.
"""
import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.integration.base import IntegrationBase

log = logging.getLogger(__name__)


class AlifService(IntegrationBase):
    code = "alif"
    name = "Alif Bank"
    category = "payment"
    description = "Alif Bank toʻlov tizimi"
    credentials_required = True

    def _secret_fields(self) -> list[str]:
        return ["api_key"]

    def _required_fields(self) -> list[str]:
        return ["merchant_id", "api_key"]

    async def test_connection(self) -> dict:
        cfg = await self.get_raw_config()
        merchant_id = cfg.get("merchant_id", "").strip()
        api_key = cfg.get("api_key", "").strip()

        if not merchant_id or not api_key:
            return {"ok": False, "error": "credentials_missing", "latency_ms": None}

        # TODO: real Alif API ping when merchant credentials are available
        return {"ok": True, "provider": "alif", "latency_ms": None}

    async def create_payment(self, order_id: str, amount: float, currency: str = "UZS") -> dict:
        # Stub: real Alif SDK call deferred — credentials required
        raise NotImplementedError("Alif payment creation — credentials required")
