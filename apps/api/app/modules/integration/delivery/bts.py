"""BTS Delivery integration scaffold (T-122).

Real API calls are deferred until api_key and account_id are provided.
All shipment methods raise NotImplementedError until credentials are live.
"""
import logging

from app.modules.integration.base import IntegrationBase

log = logging.getLogger(__name__)


class BTSDeliveryIntegration(IntegrationBase):
    code = "bts_delivery"
    name = "BTS Delivery"
    category = "delivery"
    description = "BTS yetkazib berish xizmati"
    credentials_required = True

    def _secret_fields(self) -> list[str]:
        return ["api_key"]

    def _required_fields(self) -> list[str]:
        return ["api_key", "account_id"]

    async def test_connection(self) -> dict:
        cfg = await self.get_raw_config()
        api_key = cfg.get("api_key", "").strip()
        account_id = cfg.get("account_id", "").strip()

        if not api_key or not account_id:
            return {
                "ok": False,
                "error": "credentials_missing",
                "message": "api_key va account_id kerak",
                "latency_ms": None,
                "stubbed": True,
            }
        return {
            "ok": True,
            "message": "Konfig togri (stub)",
            "latency_ms": None,
            "stubbed": True,
        }

    async def create_shipment(self, sale_id: str, address: dict, items: list) -> dict:
        raise NotImplementedError("BTS Delivery — credentials required")

    async def track_shipment(self, tracking_id: str) -> dict:
        raise NotImplementedError("BTS Delivery — credentials required")

    async def cancel_shipment(self, tracking_id: str) -> dict:
        raise NotImplementedError("BTS Delivery — credentials required")
