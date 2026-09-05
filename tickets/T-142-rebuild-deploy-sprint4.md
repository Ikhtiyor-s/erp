# T-142: Rebuild + deploy — Sprint 4

**Wave:** 4E
**Owner:** backend-dev
**Size:** S
**Depends on:** T-141

## Goal
Docker rebuild va deploy; smoke test.

## Steps
```bash
cd D:\Docker\projects\erp
docker compose build api web
docker compose up -d
docker exec erp-api pytest apps/api/tests/ -v
docker logs --since=2m erp-api
```

## Acceptance criteria
- `pytest` — 0 failed.
- API logs'da ERROR yo'q.
- `GET /integrations/status` 200 qaytaradi.
- `GET /reference/mxik/search?q=non` 200 qaytaradi.
- Frontend `https://localhost` yuklanadi.

## How we'll know it's done
Barcha service UP; pytest 0 failed; smoke URL'lar 200.
