from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, get_current_org_id, get_current_user_id
from app.modules.accounting.posting import JournalLine, post_journal_entry_or_422
from app.modules.accounting.schemas import AccountIn, AccountUpdateIn, JournalEntryIn


router = APIRouter(prefix="/accounting", tags=["accounting"])

ACCOUNT_TYPES = {"asset", "liability", "equity", "income", "expense"}


# =========================================================
# CHART OF ACCOUNTS
# =========================================================

@router.get("/accounts")
async def list_accounts(
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("""
            SELECT id, code, name, type, parent_id, linked_cashbox_id, is_system, is_active
            FROM accounts
            WHERE organization_id = :o
            ORDER BY code
        """),
        {"o": org_id},
    )
    return [dict(r._mapping) for r in res]


@router.post("/accounts", status_code=status.HTTP_201_CREATED)
async def create_account(
    body: AccountIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    if body.type not in ACCOUNT_TYPES:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Noto'g'ri hisob turi")
    exists = await db.execute(
        text("SELECT 1 FROM accounts WHERE organization_id = :o AND code = :c"),
        {"o": org_id, "c": body.code},
    )
    if exists.scalar():
        raise HTTPException(status.HTTP_409_CONFLICT, "Bu kod bilan hisob allaqachon mavjud")

    res = await db.execute(
        text("""
            INSERT INTO accounts (organization_id, code, name, type, parent_id, is_system)
            VALUES (:o, :c, :n, :t, :p, FALSE)
            RETURNING id
        """),
        {"o": org_id, "c": body.code, "n": body.name, "t": body.type, "p": body.parent_id},
    )
    await db.commit()
    return {"id": res.scalar()}


@router.put("/accounts/{account_id}")
async def update_account(
    account_id: int,
    body: AccountUpdateIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    # is_system accounts keep their code/type/hierarchy fixed — only the display name can change.
    res = await db.execute(
        text("UPDATE accounts SET name = :n WHERE id = :id AND organization_id = :o RETURNING id"),
        {"n": body.name, "id": account_id, "o": org_id},
    )
    if not res.first():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Hisob topilmadi")
    await db.commit()
    return {"ok": True}


@router.delete("/accounts/{account_id}")
async def delete_account(
    account_id: int,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    row = await db.execute(
        text("SELECT is_system FROM accounts WHERE id = :id AND organization_id = :o"),
        {"id": account_id, "o": org_id},
    )
    acc = row.first()
    if not acc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Hisob topilmadi")
    if acc.is_system:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Standart hisoblar o'chirilmaydi")
    used = await db.execute(text("SELECT 1 FROM journal_lines WHERE account_id = :id LIMIT 1"), {"id": account_id})
    if used.scalar():
        raise HTTPException(status.HTTP_409_CONFLICT, "Bu hisobda provodkalar bor, o'chirib bo'lmaydi")
    child = await db.execute(text("SELECT 1 FROM accounts WHERE parent_id = :id LIMIT 1"), {"id": account_id})
    if child.scalar():
        raise HTTPException(status.HTTP_409_CONFLICT, "Bu hisobning quyi hisoblari bor, avval ularni o'chiring")
    await db.execute(text("DELETE FROM accounts WHERE id = :id AND organization_id = :o"), {"id": account_id, "o": org_id})
    await db.commit()
    return {"ok": True}


# =========================================================
# JOURNAL
# =========================================================

@router.get("/journal")
async def list_journal(
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    source_type: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    where = "e.organization_id = :o"
    params: dict = {"o": org_id}
    if date_from:
        where += " AND e.entry_date >= :df"
        params["df"] = date_from
    if date_to:
        where += " AND e.entry_date <= :dt"
        params["dt"] = date_to
    if source_type:
        where += " AND e.source_type = :st"
        params["st"] = source_type

    res = await db.execute(
        text(f"""
            SELECT e.id, e.entry_number, e.entry_date, e.description, e.source_type, e.source_id, e.created_at,
                   (SELECT COALESCE(SUM(l.debit), 0) FROM journal_lines l WHERE l.entry_id = e.id) AS total
            FROM journal_entries e
            WHERE {where}
            ORDER BY e.entry_date DESC, e.created_at DESC
        """),
        params,
    )
    return [dict(r._mapping) for r in res]


@router.get("/journal/{entry_id}")
async def get_journal_entry(
    entry_id: str,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    entry_res = await db.execute(
        text("""
            SELECT id, entry_number, entry_date, description, source_type, source_id, created_at
            FROM journal_entries WHERE id = :id AND organization_id = :o
        """),
        {"id": entry_id, "o": org_id},
    )
    entry = entry_res.first()
    if not entry:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Provodka topilmadi")

    lines_res = await db.execute(
        text("""
            SELECT l.id, l.account_id, a.code AS account_code, a.name AS account_name,
                   l.debit, l.credit, l.currency_id, l.rate, l.amount_base,
                   l.counterparty_type, l.counterparty_id, l.description
            FROM journal_lines l
            JOIN accounts a ON a.id = l.account_id
            WHERE l.entry_id = :id
            ORDER BY l.id
        """),
        {"id": entry_id},
    )
    return {**dict(entry._mapping), "lines": [dict(r._mapping) for r in lines_res]}


@router.post("/journal", status_code=status.HTTP_201_CREATED)
async def create_journal_entry(
    body: JournalEntryIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    lines = [
        JournalLine(
            account_id=l.account_id, debit=l.debit, credit=l.credit,
            currency_id=l.currency_id, rate=l.rate,
            counterparty_type=l.counterparty_type, counterparty_id=l.counterparty_id,
            description=l.description,
        )
        for l in body.lines
    ]
    entry_id = await post_journal_entry_or_422(
        db, org_id, lines,
        source_type="manual", source_id=None,
        description=body.description, user_id=user_id, entry_date=body.entry_date,
    )
    await db.commit()
    return {"id": entry_id}
