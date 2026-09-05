"""Yandex Delivery integration scaffold (T-121).

Real API calls are deferred until OAuth token and sender_id are provided.
All shipment methods raise NotImplementedError until credentials are live.
"""
import logging

from app.modules.integration.base import IntegrationBase

log = logging.getLogger(__name__)


class YandexDeliveryIntegration(IntegrationBase):
    code = "yandex_delivery"
    name = "Yandex Delivery"
    category = "delivery"
    description = "Yandex yetkazib berish xizmati"
    credentials_required = True

    def _secret_fields(self) -> list[str]:
        return ["oauth_token"]

    def _required_fields(self) -> list[str]:
        return ["oauth_token", "sender_id"]

    async def test_connection(self) -> dict:
        cfg = await self.get_raw_config()
        oauth_token = cfg.get("oauth_token", "").strip()
        sender_id = cfg.get("sender_id", "").strip()

        if not oauth_token or not sender_id:
            return {
                "ok": False,
                "error": "credentials_missing",
                "message": "oauth_token va sender_id kerak",
                "latency_ms": None,
                "stubbed": True,
            }
        return {
            "ok": True,
            "message": "Konfig togri (stub)",
            "latency_ms": None,
            "stubbed": True,
        }

    async def estimate(self, address: dict, items: list) -> dict:
        """Return stub estimate — real Yandex Delivery API call deferred."""
        return {"status": "stub", "message": "credentials_required", "stubbed": True}

    async def create_shipment(self, sale_id: str, address: dict, items: list) -> dict:
        raise NotImplementedError("Yandex Delivery — credentials required")

    async def track_shipment(self, tracking_id: str) -> dict:
        raise NotImplementedError("Yandex Delivery — credentials required")

    async def cancel_shipment(self, tracking_id: str) -> dict:
        raise NotImplementedError("Yandex Delivery — credentials required")
