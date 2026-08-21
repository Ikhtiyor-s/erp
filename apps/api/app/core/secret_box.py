"""Symmetric encryption for at-rest sensitive settings (SMS passwords, API keys).

Production must set SECRETS_FERNET_KEY (`Fernet.generate_key().decode()`).
Dev fallback derives a 32-byte key from SECRET_KEY (deterministic, NOT secure).
"""
import base64
import hashlib
import logging

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings


log = logging.getLogger(__name__)

_ENC_PREFIX = "fernet:"  # marks encrypted values in JSONB


def _derive_dev_key(seed: str) -> bytes:
    """Derive a Fernet-compatible key from SECRET_KEY (dev fallback)."""
    digest = hashlib.sha256(seed.encode()).digest()
    return base64.urlsafe_b64encode(digest)


def _get_fernet() -> Fernet:
    key = settings.SECRETS_FERNET_KEY
    if not key:
        if settings.ENV == "production":
            raise RuntimeError(
                "SECRETS_FERNET_KEY must be set in production "
                "(generate via `python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'`)"
            )
        log.warning("SECRETS_FERNET_KEY not set — using SECRET_KEY-derived dev key")
        return Fernet(_derive_dev_key(settings.SECRET_KEY))
    return Fernet(key.encode() if isinstance(key, str) else key)


_box = _get_fernet()


def encrypt(plain: str) -> str:
    """Encrypt a plain string and prefix with `fernet:` marker."""
    if not plain:
        return plain
    if plain.startswith(_ENC_PREFIX):
        return plain  # already encrypted
    token = _box.encrypt(plain.encode("utf-8")).decode("ascii")
    return _ENC_PREFIX + token


def decrypt(value: str | None) -> str | None:
    """Decrypt a value if it has the `fernet:` prefix; return as-is otherwise.

    The pass-through is intentional for backward compatibility with existing
    plain-text records — read them, then save will re-encrypt.
    """
    if not value:
        return value
    if not value.startswith(_ENC_PREFIX):
        return value
    try:
        return _box.decrypt(value[len(_ENC_PREFIX):].encode("ascii")).decode("utf-8")
    except InvalidToken:
        log.error("Failed to decrypt setting — wrong key or corrupted ciphertext")
        return None


def is_encrypted(value: str | None) -> bool:
    return bool(value) and value.startswith(_ENC_PREFIX)
