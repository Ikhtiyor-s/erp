from pydantic import BaseModel, Field


class AccountIn(BaseModel):
    code: str
    name: str
    type: str  # asset|liability|equity|income|expense
    parent_id: int | None = None


class AccountUpdateIn(BaseModel):
    name: str


class JournalLineIn(BaseModel):
    account_id: int
    debit: float = 0
    credit: float = 0
    currency_id: int | None = None
    rate: float = 1
    counterparty_type: str | None = None
    counterparty_id: str | None = None
    description: str | None = None


class JournalEntryIn(BaseModel):
    entry_date: str | None = None
    description: str | None = None
    lines: list[JournalLineIn] = Field(min_length=2)
