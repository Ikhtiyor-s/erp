"""Multicard payment integration scaffold.

Real API: https://api.multicard.uz/ — credentials not yet available.
All payment methods raise NotImplementedError until real credentials are provided.
"""
from app.modules.integration.base import ScaffoldIntegrationBase


class MulticardService(ScaffoldIntegrationBase):
    code = "multicard"
    name = "Multicard"
    category = "payment"
    description = "Multicard toʻlov tizimi"
    credentials_required = True

    def _secret_fields(self) -> list[str]:
        return ["api_key"]

    def _required_fields(self) -> list[str]:
        return ["api_key", "terminal_id"]

    async def test_connection(self) -> dict:
        cfg = await self.get_raw_config()
        if not cfg.get("api_key") or not cfg.get("terminal_id"):
            return {
                "ok": False,
                "message": "api_key va terminal_id kerak",
                "latency_ms": None,
                "stubbed": True,
            }
        return {
            "ok": True,
            "message": "Konfig to'g'ri (stub)",
            "latency_ms": None,
            "stubbed": True,
        }

    async def create_payment(self, amount: int, order_id: str, **kwargs) -> dict:
        raise NotImplementedError("Multicard payment — credentials required")

    async def handle_webhook(self, payload: dict) -> dict:
        """Stub webhook handler — log and acknowledge."""
        return {"ok": True, "stubbed": True}
