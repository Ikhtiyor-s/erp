"""baseline — captures existing schema from init.sql + schema_patches.py

This migration is intentionally a no-op. The actual schema is bootstrapped by:
  1. infra/postgres/init.sql (runs on fresh container)
  2. apps/api/app/db/schema_patches.py (runs on app startup)
  3. apps/api/app/modules/rbac/seed.py (runs on app startup)

After applying this baseline, new schema changes go through Alembic:
    docker exec erp-api alembic revision -m "add foo column"
    docker exec erp-api alembic upgrade head

To mark an existing database as being at this baseline (no re-run):
    docker exec erp-api alembic stamp 0001_baseline

Revision ID: 0001_baseline
Revises:
Create Date: 2026-06-22
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0001_baseline"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # No-op — schema already exists via init.sql + schema_patches.py
    pass


def downgrade() -> None:
    # No-op — baseline cannot be reversed
    pass
