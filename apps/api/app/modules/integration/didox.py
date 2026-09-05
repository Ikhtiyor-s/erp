"""DidoxIntegration — elektron faktura (e-invoice) for Uzbekistan.

Scaffold implementation: config save/load and test_connection work.
create_invoice / send_invoice / get_invoice_status raise NotImplementedError
until real Didox credentials are available.
"""
from app.modules.integration.base import IntegrationBase


class DidoxIntegration(IntegrationBase):
    code = "didox"
    name = "Didox"
    category = "e_invoice"
    description = "Didox elektron faktura tizimi (O'zbekiston EHF/EHUB)"
    credentials_required = True

    def _secret_fields(self) -> list[str]:
        return ["developer_token", "signer_pin"]

    def _required_fields(self) -> list[str]:
        return ["stir", "developer_token"]

    async def test_connection(self) -> dict:
        cfg = await self.get_raw_config()
        if not cfg.get("stir") or not cfg.get("developer_token"):
            return {
                "ok": False,
                "message": "STIR va developer_token kerak",
                "latency_ms": None,
                "stubbed": True,
            }
        return {
            "ok": True,
            "message": "Konfig to'g'ri (stub — real ping pending credentials)",
            "latency_ms": None,
            "stubbed": True,
        }

    async def create_invoice(self, sale_id: str) -> dict:
        raise NotImplementedError("Didox create_invoice — credentials required")

    async def send_invoice(self, invoice_id: str) -> dict:
        raise NotImplementedError("Didox send_invoice — credentials required")

    async def get_invoice_status(self, invoice_id: str) -> dict:
        raise NotImplementedError("Didox get_invoice_status — credentials required")
