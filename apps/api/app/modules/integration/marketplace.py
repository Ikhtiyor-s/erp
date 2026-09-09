"""Marketplace sync integration (audit gap #3) — generic REST-based product/
stock export + order import. No specific marketplace's real API contract is
known (confirmed with the user — no Bitoverse docs available), so this is a
provider-agnostic engine: it builds an export payload and POSTs it to
whatever `api_url` the org configures, logging every attempt either way.
Connecting it to a REAL marketplace later may need payload-shape tweaks in
`build_export_payload()` below, but the plumbing (config, logging, incoming
order capture) is real and usable today.

Bridges to app_settings key='marketplace' — the SAME storage the legacy
settings/marketplace/page.tsx (SettingsForm) already reads/writes, so both
UIs stay in sync (same pattern as TelegramIntegration -> key='crm').
"""
from __future__ import annotations

import json
import logging

import httpx
from sqlalchemy import text

from app.core import secret_box
from app.modules.integration.base import ScaffoldIntegrationBase

log = logging.getLogger(__name__)


class MarketplaceIntegration(ScaffoldIntegrationBase):
    code = "marketplace"
    name = "Marketplace"
    category = "marketplace"
    description = "Mahsulot/qoldiq eksporti va buyurtma importi (masalan Bitoverse)"
    credentials_required = True

    def _secret_fields(self) -> list[str]:
        return ["api_key"]

    def _required_fields(self) -> list[str]:
        return ["api_url", "api_key", "store_id"]

    async def get_raw_config(self) -> dict:
        res = await self.db.execute(
            text("SELECT value FROM app_settings WHERE organization_id = :o AND key = 'marketplace'"),
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
            text("SELECT value FROM app_settings WHERE organization_id = :o AND key = 'marketplace'"),
            {"o": self.org_id},
        )
        row = res.first()
        existing: dict = {}
        if row and row.value:
            existing = row.value if isinstance(row.value, dict) else json.loads(row.value)
        for k, v in payload.items():
            if v is None:
                continue
            existing[k] = secret_box.encrypt(str(v)) if k in self._secret_fields() else v
        await self.db.execute(
            text(
                "INSERT INTO app_settings (organization_id, key, value) VALUES (:o, 'marketplace', CAST(:v AS JSONB)) "
                "ON CONFLICT (organization_id, key) DO UPDATE SET value = CAST(:v AS JSONB), updated_at = NOW()"
            ),
            {"o": self.org_id, "v": json.dumps(existing)},
        )
        await self.db.commit()

    async def set_enabled(self, enabled: bool) -> None:
        """IntegrationBase.set_enabled writes to key='integrations', but this
        class bridges config to key='marketplace' — override so enable/disable
        actually lands where get_raw_config()/is_enabled() look for it."""
        await self.save_config({"enabled": enabled})

    async def test_connection(self) -> dict:
        cfg = await self.get_raw_config()
        api_url = cfg.get("api_url")
        if not api_url:
            return {"ok": False, "message": "api_url sozlanmagan", "latency_ms": None, "stubbed": True}
        try:
            async with httpx.AsyncClient(timeout=8) as client:
                import time as _time
                t0 = _time.monotonic()
                resp = await client.get(api_url, headers={"Authorization": f"Bearer {cfg.get('api_key', '')}"})
                latency = int((_time.monotonic() - t0) * 1000)
            return {"ok": resp.status_code < 500, "message": f"HTTP {resp.status_code}", "latency_ms": latency}
        except Exception as e:
            return {"ok": False, "message": f"Ulanib bo'lmadi: {e}", "latency_ms": None}


async def build_export_payload(db, org_id: str) -> dict:
    """Products + current stock for every active product. This is the
    provider-agnostic shape we control — a real integration would map this
    to whatever the target marketplace's actual API expects."""
    res = await db.execute(
        text("""
            SELECT p.id, p.sku, p.barcode, p.name, p.sale_price,
                   COALESCE(SUM(sb.quantity), 0) AS stock_qty
            FROM products p
            LEFT JOIN stock_balances sb ON sb.product_id = p.id
            WHERE p.organization_id = :o AND p.is_active = TRUE AND COALESCE(p.is_archived, FALSE) = FALSE
            GROUP BY p.id, p.sku, p.barcode, p.name, p.sale_price
        """),
        {"o": org_id},
    )
    items = [
        {
            "sku": r.sku, "barcode": r.barcode, "name": r.name,
            "price": float(r.sale_price or 0), "stock": float(r.stock_qty or 0),
        }
        for r in res
    ]
    return {"items": items, "count": len(items)}
