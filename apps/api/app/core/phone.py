"""Shared phone-number helpers (Uzbek mobile numbers).

Extracted from app.modules.customer_portal.auth so both the customer
portal OTP login and the staff registration OTP flow use one
implementation.
"""
from __future__ import annotations

import secrets


def normalize_phone(phone: str) -> str:
    """Normalize a phone number to canonical +998XXXXXXXXX form.

    Raises ValueError for anything that isn't a valid Uzbek mobile number
    so callers can map it to HTTP 422 — never silently returns a partial
    string.
    """
    if phone is None:
        raise ValueError("phone is required")
    digits = "".join(ch for ch in str(phone) if ch.isdigit())
    if not digits:
        raise ValueError("phone must contain digits")
    if digits.startswith("998") and len(digits) == 12:
        digits = digits[-9:]
    elif digits.startswith("0") and len(digits) == 10:
        digits = digits[1:]
    if len(digits) != 9:
        raise ValueError(
            f"invalid phone: national part must be 9 digits, got {len(digits)}"
        )
    return "+998" + digits


def generate_otp(length: int = 6) -> str:
    """Crypto-random numeric OTP."""
    return "".join(str(secrets.randbelow(10)) for _ in range(length))
