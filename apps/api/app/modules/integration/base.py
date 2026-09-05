"""IntegrationBase — shared abstract class for all integration providers.

Each concrete provider subclass declares `code`, `name`, `category`,
`credentials_required`, and implements the three abstract methods.
Config is persisted per-org in app_settings JSONB under key='integrations'.
Secret fields are encrypted with secret_box before storage.
"""
import json
import time
from abc import ABC, abstractmethod

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import secret_box


_ENC_PREFIX = "fernet:"

# Field names that must be encrypted at rest.
SECRET_FIELD_SUFFIXES = (
    "key", "secret", "token", "password", "merchant_id",
    "client_secret", "terminal_id",
)


def _is_secret_field(name: str) -> bool:
    n = name.lower()
    return any(n.endswith(s) for s in SECRET_FIELD_SUFFIXES)


def _sensor_value(plain: str) -> str:
    """Return last 4 chars visible, rest replaced with '***'."""
    if not plain or len(plain) <= 4:
        return "***"
    return "***" + plain[-4:]


class IntegrationBase(ABC):
    code: str
    name: str
    category: str
    description: str = ""
    credentials_required: bool = True

    def __init__(self, db: AsyncSession, org_id: str) -> None:
        self.db = db
        self.org_id = org_id

    # ------------------------------------------------------------------
    # Abstract interface — every concrete provider must implement these
    # ------------------------------------------------------------------

    @abstractmethod
    async def test_connection(self) -> dict:
        """Returns {"ok": bool, "message": str, "latency_ms": int | None}."""
        ...

    @abstractmethod
    def _secret_fields(self) -> list[str]:
        """Return list of config field names that are secrets."""
        ...

    @abstractmethod
    def _required_fields(self) -> list[str]:
        """Return list of config field names that are required to be configured."""
        ...

    # ------------------------------------------------------------------
    # Shared CRUD — no need to override in subclasses
    # ------------------------------------------------------------------

    async def get_raw_config(self) -> dict:
        """Read and decrypt config from app_settings key='integrations'."""
        res = await self.db.execute(
            text(
                "SELECT value FROM app_settings "
                "WHERE organization_id = :o AND key = 'integrations'"
            ),
            {"o": self.org_id},
        )
        row = res.first()
        if not row or not row.value:
            return {}
        all_cfg = row.value if isinstance(row.value, dict) else json.loads(row.value)
        provider_cfg = dict(all_cfg.get(self.code) or {})
        # Decrypt secret fields
        for field in self._secret_fields():
            if field in provider_cfg:
                provider_cfg[field] = secret_box.decrypt(provider_cfg[field])
        return provider_cfg

    async def get_public_config(self) -> dict:
        """Return config with secret values sensored (last 4 chars only)."""
        raw = await self.get_raw_config()
        public = {}
        for k, v in raw.items():
            if k == "enabled":
                public[k] = v
                continue
            if _is_secret_field(k) or k in self._secret_fields():
                public[k] = _sensor_value(str(v)) if v else ""
            else:
                public[k] = v
        return public

    async def save_config(self, payload: dict) -> None:
        """Encrypt secret fields and upsert into app_settings[code]."""
        to_store = {}
        for k, v in payload.items():
            if v is None:
                continue
            if _is_secret_field(k) or k in self._secret_fields():
                to_store[k] = secret_box.encrypt(str(v))
            else:
                to_store[k] = v

        # Read current full integrations blob, merge, write back
        res = await self.db.execute(
            text(
                "SELECT value FROM app_settings "
                "WHERE organization_id = :o AND key = 'integrations'"
            ),
            {"o": self.org_id},
        )
        row = res.first()
        all_cfg: dict = {}
        if row and row.value:
            all_cfg = row.value if isinstance(row.value, dict) else json.loads(row.value)

        existing = dict(all_cfg.get(self.code) or {})
        existing.update(to_store)
        all_cfg[self.code] = existing

        await self.db.execute(
            text(
                "INSERT INTO app_settings (organization_id, key, value) "
                "VALUES (:o, 'integrations', CAST(:v AS JSONB)) "
                "ON CONFLICT (organization_id, key) "
                "DO UPDATE SET value = CAST(:v AS JSONB), updated_at = NOW()"
            ),
            {"o": self.org_id, "v": json.dumps(all_cfg)},
        )
        await self.db.commit()

    async def set_enabled(self, enabled: bool) -> None:
        """Toggle the enabled flag without touching other config."""
        res = await self.db.execute(
            text(
                "SELECT value FROM app_settings "
                "WHERE organization_id = :o AND key = 'integrations'"
            ),
            {"o": self.org_id},
        )
        row = res.first()
        all_cfg: dict = {}
        if row and row.value:
            all_cfg = row.value if isinstance(row.value, dict) else json.loads(row.value)

        provider_cfg = dict(all_cfg.get(self.code) or {})
        provider_cfg["enabled"] = enabled
        all_cfg[self.code] = provider_cfg

        await self.db.execute(
            text(
                "INSERT INTO app_settings (organization_id, key, value) "
                "VALUES (:o, 'integrations', CAST(:v AS JSONB)) "
                "ON CONFLICT (organization_id, key) "
                "DO UPDATE SET value = CAST(:v AS JSONB), updated_at = NOW()"
            ),
            {"o": self.org_id, "v": json.dumps(all_cfg)},
        )
        await self.db.commit()

    async def is_enabled(self) -> bool:
        cfg = await self.get_raw_config()
        return bool(cfg.get("enabled", False))

    async def is_configured(self) -> bool:
        """True when all required fields have non-empty values."""
        if not self._required_fields():
            return True
        cfg = await self.get_raw_config()
        return all(bool(cfg.get(f)) for f in self._required_fields())

    async def get_status(self) -> str:
        """Returns one of: not_configured | configured | active | error."""
        if not self.credentials_required:
            return "active"
        configured = await self.is_configured()
        if not configured:
            return "not_configured"
        if await self.is_enabled():
            return "active"
        return "configured"


class ScaffoldIntegrationBase(IntegrationBase):
    """Base for scaffold integrations — test_connection always returns stubbed ok=False."""

    def _secret_fields(self) -> list[str]:
        return []

    def _required_fields(self) -> list[str]:
        return []

    async def test_connection(self) -> dict:
        return {
            "ok": False,
            "message": "Sandbox credentials sozlanmagan",
            "latency_ms": None,
            "stubbed": True,
        }


class NoCredentialsIntegrationBase(IntegrationBase):
    """Base for integrations that need no external credentials (tools)."""

    credentials_required = False

    def _secret_fields(self) -> list[str]:
        return []

    def _required_fields(self) -> list[str]:
        return []

    async def test_connection(self) -> dict:
        return {"ok": True, "message": "Mahalliy, credentials kerak emas", "latency_ms": 0}
