"""Integration registry — maps provider code to concrete class.

All scaffold integrations (Alif, Uzum, etc.) live here as placeholder
classes. Wave 4B/4C tickets will flesh out the real implementations.
Existing integrations (Click, Payme, Telegram, Eskiz) are wrapped so
the Hub can manage them uniformly.
"""
import json

from sqlalchemy import text

from app.core import secret_box
from app.modules.integration.base import (
    IntegrationBase,
    NoCredentialsIntegrationBase,
    ScaffoldIntegrationBase,
)
from app.modules.integration.delivery.bts import BTSDeliveryIntegration
from app.modules.integration.delivery.yandex import YandexDeliveryIntegration
from app.modules.integration.didox import DidoxIntegration
from app.modules.integration.payments.alif import AlifService
from app.modules.integration.payments.multicard import MulticardService
from app.modules.integration.payments.rahmat import RahmatService
from app.modules.integration.payments.uzum import UzumService


# ---------------------------------------------------------------------------
# Wave 4B scaffolds — payment providers (T-110..T-113)
# ---------------------------------------------------------------------------


class BillPaymentService(ScaffoldIntegrationBase):
    code = "bill_payment"
    name = "Kommunal toʻlov"
    category = "payment"
    description = "Click orqali kommunal toʻlov"
    credentials_required = False

    def _secret_fields(self) -> list[str]:
        return []

    def _required_fields(self) -> list[str]:
        return []

    async def test_connection(self) -> dict:
        return {"ok": True, "message": "Click orqali ishlaydi", "latency_ms": 0}


# ---------------------------------------------------------------------------
# Existing payment wrappers — Click / Payme
# ---------------------------------------------------------------------------

class _OnlinePaymentIntegration(ScaffoldIntegrationBase):
    """Mixin: read/write app_settings key='online_payments' sub-key=self.code.

    Legacy webhook handlers (payments/base.py:get_payment_settings) read from
    this key. Hub save_config must write here so webhook handlers see the config.
    """

    async def get_raw_config(self) -> dict:
        res = await self.db.execute(
            text(
                "SELECT value FROM app_settings "
                "WHERE organization_id = :o AND key = 'online_payments'"
            ),
            {"o": self.org_id},
        )
        row = res.first()
        if not row or not row.value:
            return {}
        all_cfg = row.value if isinstance(row.value, dict) else json.loads(row.value)
        cfg = dict(all_cfg.get(self.code) or {})
        for field in self._secret_fields():
            if field in cfg:
                cfg[field] = secret_box.decrypt(cfg[field])
        return cfg

    async def save_config(self, payload: dict) -> None:
        res = await self.db.execute(
            text(
                "SELECT value FROM app_settings "
                "WHERE organization_id = :o AND key = 'online_payments'"
            ),
            {"o": self.org_id},
        )
        row = res.first()
        all_cfg: dict = {}
        if row and row.value:
            all_cfg = row.value if isinstance(row.value, dict) else json.loads(row.value)

        existing = dict(all_cfg.get(self.code) or {})
        for k, v in payload.items():
            if v is None:
                continue
            if k in self._secret_fields():
                existing[k] = secret_box.encrypt(str(v))
            else:
                existing[k] = v
        all_cfg[self.code] = existing

        await self.db.execute(
            text(
                "INSERT INTO app_settings (organization_id, key, value) "
                "VALUES (:o, 'online_payments', CAST(:v AS JSONB)) "
                "ON CONFLICT (organization_id, key) "
                "DO UPDATE SET value = CAST(:v AS JSONB), updated_at = NOW()"
            ),
            {"o": self.org_id, "v": json.dumps(all_cfg)},
        )
        await self.db.commit()


class ClickIntegration(_OnlinePaymentIntegration):
    code = "click"
    name = "Click"
    category = "payment"
    description = "Click Merchant toʻlov tizimi"
    credentials_required = True

    def _secret_fields(self) -> list[str]:
        return ["merchant_id", "secret_key"]

    def _required_fields(self) -> list[str]:
        return ["merchant_id", "service_id", "secret_key"]


class PaymeIntegration(_OnlinePaymentIntegration):
    code = "payme"
    name = "Payme"
    category = "payment"
    description = "Payme Merchant toʻlov tizimi"
    credentials_required = True

    def _secret_fields(self) -> list[str]:
        return ["merchant_id", "secret_key"]

    def _required_fields(self) -> list[str]:
        return ["merchant_id", "secret_key"]


# Wave 4C delivery integrations (T-121, T-122) — implemented in delivery/ subpackage.
# YandexDeliveryIntegration and BTSDeliveryIntegration imported at top of file.


# ---------------------------------------------------------------------------
# Existing communication integrations — Telegram / Eskiz
# ---------------------------------------------------------------------------

class TelegramIntegration(ScaffoldIntegrationBase):
    """Hub wrapper for Telegram.

    Legacy handlers (telegram.py) read config from app_settings key='crm'.
    This class bridges the Hub's generic save/load interface to that same key
    so changes made in the Hub are immediately visible to notify_sale() etc.
    Config shape: {bot_token, bot_username, channel_id, notify_sale,
                   notify_low_stock, ...} — same as legacy.
    """

    code = "telegram"
    name = "Telegram Bot"
    category = "communication"
    description = "Telegram bot bildirishnomalar"
    credentials_required = True

    def _secret_fields(self) -> list[str]:
        return ["bot_token"]

    def _required_fields(self) -> list[str]:
        return ["bot_token"]

    async def get_raw_config(self) -> dict:
        res = await self.db.execute(
            text(
                "SELECT value FROM app_settings "
                "WHERE organization_id = :o AND key = 'crm'"
            ),
            {"o": self.org_id},
        )
        row = res.first()
        if not row or not row.value:
            return {}
        cfg = row.value if isinstance(row.value, dict) else json.loads(row.value)
        for field in self._secret_fields():
            if field in cfg:
                cfg[field] = secret_box.decrypt(cfg[field])
        return cfg

    async def save_config(self, payload: dict) -> None:
        res = await self.db.execute(
            text(
                "SELECT value FROM app_settings "
                "WHERE organization_id = :o AND key = 'crm'"
            ),
            {"o": self.org_id},
        )
        row = res.first()
        existing: dict = {}
        if row and row.value:
            existing = row.value if isinstance(row.value, dict) else json.loads(row.value)

        for k, v in payload.items():
            if v is None:
                continue
            if k in self._secret_fields():
                existing[k] = secret_box.encrypt(str(v))
            else:
                existing[k] = v

        await self.db.execute(
            text(
                "INSERT INTO app_settings (organization_id, key, value) "
                "VALUES (:o, 'crm', CAST(:v AS JSONB)) "
                "ON CONFLICT (organization_id, key) "
                "DO UPDATE SET value = CAST(:v AS JSONB), updated_at = NOW()"
            ),
            {"o": self.org_id, "v": json.dumps(existing)},
        )
        await self.db.commit()


class EskizIntegration(ScaffoldIntegrationBase):
    code = "eskiz"
    name = "Eskiz SMS"
    category = "communication"
    description = "Eskiz.uz SMS xizmati"
    credentials_required = True

    def _secret_fields(self) -> list[str]:
        return ["password"]

    def _required_fields(self) -> list[str]:
        return ["email", "password"]


# ---------------------------------------------------------------------------
# Tool integrations — no external API
# ---------------------------------------------------------------------------

class BarcodeIntegration(NoCredentialsIntegrationBase):
    code = "barcode"
    name = "Barcode Scan/Print"
    category = "tools"
    description = "Brauzer barcode skanerи va chop etish"


class OneCExportIntegration(NoCredentialsIntegrationBase):
    code = "1c_export"
    name = "1C Export"
    category = "accounting"
    description = "1C uchun CSV/XML eksport"


class MxikIntegration(NoCredentialsIntegrationBase):
    code = "mxik"
    name = "MXIK Katalog"
    category = "tools"
    description = "Soliq.uz MXIK mahsulot katalogi"


# ---------------------------------------------------------------------------
# Master registry
# ---------------------------------------------------------------------------

INTEGRATION_REGISTRY: dict[str, type[IntegrationBase]] = {
    "alif":             AlifService,
    "uzum":             UzumService,
    "multicard":        MulticardService,
    "rahmat":           RahmatService,
    "bill_payment":     BillPaymentService,
    "click":            ClickIntegration,
    "payme":            PaymeIntegration,
    "didox":            DidoxIntegration,
    "yandex_delivery":  YandexDeliveryIntegration,
    "bts_delivery":     BTSDeliveryIntegration,
    "telegram":         TelegramIntegration,
    "eskiz":            EskizIntegration,
    "barcode":          BarcodeIntegration,
    "1c_export":        OneCExportIntegration,
    "mxik":             MxikIntegration,
}


def get_integration(code: str, db, org_id: str) -> IntegrationBase | None:
    """Instantiate integration by code, or return None if unknown."""
    cls = INTEGRATION_REGISTRY.get(code)
    if cls is None:
        return None
    return cls(db=db, org_id=org_id)
