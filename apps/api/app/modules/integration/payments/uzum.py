"""Uzum Bank payment integration — scaffold (Wave 4B, T-111).

Real implementation requires Uzum credentials (client_id + client_secret).
Until credentials are configured, test_connection returns stubbed=True.
"""
from app.modules.integration.base import ScaffoldIntegrationBase


class UzumService(ScaffoldIntegrationBase):
    code = "uzum"
    name = "Uzum Bank"
    category = "payment"
    description = "Uzum Bank toʻlov tizimi"
    credentials_required = True

    def _secret_fields(self) -> list[str]:
        return ["client_id", "client_secret"]

    def _required_fields(self) -> list[str]:
        return ["client_id", "client_secret"]
