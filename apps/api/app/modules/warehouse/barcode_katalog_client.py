import logging

import httpx

from app.core.config import settings

log = logging.getLogger(__name__)

_LOOKUP_TIMEOUT_SECONDS = 0.3
_CONTRIBUTE_TIMEOUT_SECONDS = 2.0


def _configured() -> bool:
    return bool(settings.BARCODE_KATALOG_BASE_URL and settings.BARCODE_KATALOG_API_KEY)


async def lookup(barcode: str) -> dict | None:
    """GET /v1/lookup/{barcode} on the shared barcode-katalog service.

    Returns the entry dict on a 200 hit. Returns None on 404 (real miss),
    400 (shape rejected by the shared service), 401/429, any network
    error/timeout, or when BARCODE_KATALOG_BASE_URL/API_KEY aren't
    configured — callers MUST treat all of these identically to their own
    ordinary miss (DESIGN.md §9), never as an error to propagate.
    """
    if not _configured():
        return None
    url = f"{settings.BARCODE_KATALOG_BASE_URL.rstrip('/')}/v1/lookup/{barcode}"
    try:
        async with httpx.AsyncClient(timeout=_LOOKUP_TIMEOUT_SECONDS) as client:
            resp = await client.get(
                url, headers={"X-API-Key": settings.BARCODE_KATALOG_API_KEY}
            )
    except httpx.HTTPError as exc:
        log.warning("barcode-katalog lookup unreachable for %r: %s", barcode, exc)
        return None

    if resp.status_code in (401, 429) or resp.status_code >= 500:
        log.warning(
            "barcode-katalog lookup returned %s for %r", resp.status_code, barcode
        )
        return None
    if resp.status_code != 200:
        return None

    try:
        data = resp.json()
    except ValueError:
        log.warning("barcode-katalog lookup returned non-JSON body for %r", barcode)
        return None
    if not isinstance(data, dict) or not data.get("name"):
        return None
    return data


async def contribute(barcode: str, name: str, contributor_org_id: str) -> None:
    """Fire-and-forget POST /v1/contribute on the shared barcode-katalog service.

    Never raises. Any failure (unreachable, timeout, non-200, bad
    response) is caught and logged as a warning so a dropped contribution
    is debuggable (DESIGN.md §9) instead of silently disappearing.
    """
    if not _configured():
        return
    url = f"{settings.BARCODE_KATALOG_BASE_URL.rstrip('/')}/v1/contribute"
    try:
        async with httpx.AsyncClient(timeout=_CONTRIBUTE_TIMEOUT_SECONDS) as client:
            resp = await client.post(
                url,
                headers={"X-API-Key": settings.BARCODE_KATALOG_API_KEY},
                json={
                    "barcode": barcode,
                    "name": name,
                    "contributor_org_id": contributor_org_id,
                },
            )
        if resp.status_code != 200:
            log.warning(
                "barcode-katalog contribute failed for %r: %s %s",
                barcode, resp.status_code, resp.text,
            )
    except httpx.HTTPError as exc:
        log.warning("barcode-katalog contribute unreachable for %r: %s", barcode, exc)
