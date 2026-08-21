from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, get_current_user_id, get_current_org_id
from app.modules.rbac.deps import require_permission


router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.get("/mine")
async def my_organizations(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    res = await db.execute(
        text(
            "SELECT o.id, o.name, o.code, uo.is_default "
            "FROM organizations o "
            "JOIN user_organizations uo ON uo.organization_id = o.id "
            "WHERE uo.user_id = :u AND o.is_active = TRUE "
            "ORDER BY uo.is_default DESC, o.name"
        ),
        {"u": user_id},
    )
    return [dict(r._mapping) for r in res]


@router.get("/current")
async def current_organization(
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    """Active organization full info + counts."""
    res = await db.execute(
        text(
            "SELECT o.id, o.name, o.code, o.tin, o.address, o.phone, o.logo_url, "
            "       o.is_active, o.created_at, "
            "       (SELECT COUNT(*) FROM user_organizations WHERE organization_id = o.id) AS user_count, "
            "       (SELECT COUNT(*) FROM customers WHERE organization_id = o.id) AS customer_count, "
            "       (SELECT COUNT(*) FROM products WHERE organization_id = o.id) AS product_count, "
            "       (SELECT COUNT(*) FROM sales WHERE organization_id = o.id) AS sale_count "
            "FROM organizations o WHERE o.id = :o"
        ),
        {"o": org_id},
    )
    row = res.first()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tashkilot topilmadi")
    return dict(row._mapping)


class OrgUpdateIn(BaseModel):
    name: str
    tin: str | None = None
    address: str | None = None
    phone: str | None = None
    logo_url: str | None = None


@router.put("/current",
            dependencies=[Depends(require_permission("org.update"))])
async def update_current_organization(
    p: OrgUpdateIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    await db.execute(
        text(
            "UPDATE organizations SET name=:n, tin=:t, address=:a, phone=:ph, "
            "logo_url=:l, updated_at=NOW() WHERE id=:o"
        ),
        {"n": p.name, "t": p.tin, "a": p.address, "ph": p.phone,
         "l": p.logo_url, "o": org_id},
    )
    await db.commit()
    return {"ok": True}
