from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


# --- Cashbox ---

class CashboxCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    currency_id: int
    responsible_id: UUID | None = None


class CashboxOut(BaseModel):
    id: int
    name: str
    currency_id: int
    balance: Decimal
    is_active: bool


# --- Cash movement (universal kassa harakati) ---

class CashMovementCreate(BaseModel):
    cashbox_id: int
    direction: Literal["in", "out", "transfer"]
    amount: Decimal = Field(gt=0)
    currency_id: int
    rate: Decimal = Field(default=Decimal("1"))
    payment_type_id: int | None = None
    customer_id: UUID | None = None
    supplier_id: UUID | None = None
    employee_id: UUID | None = None
    sale_id: UUID | None = None
    description: str | None = None


class CashMovementOut(BaseModel):
    id: int
    cashbox_id: int
    direction: str
    amount: Decimal
    currency_id: int
    description: str | None
    movement_date: datetime


# --- Set balance ---

class CashboxSetBalance(BaseModel):
    cashbox_id: int
    new_balance: Decimal
    reason: str | None = None


class EntitySetBalance(BaseModel):
    subject_type: Literal["customer", "supplier", "employee", "person"]
    subject_id: UUID
    plan_amount: Decimal
    fact_amount: Decimal
    currency_id: int
    notes: str | None = None


# --- Extra cost ---

class ExtraCostCreate(BaseModel):
    cost_date: datetime
    category: str
    amount: Decimal = Field(gt=0)
    currency_id: int
    cashbox_id: int | None = None
    description: str | None = None
