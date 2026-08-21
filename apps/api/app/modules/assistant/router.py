"""
AI assistant endpoint.

Supports two backends:
  - Anthropic Claude (if ANTHROPIC_API_KEY is set)
  - OpenAI (if OPENAI_API_KEY is set)

If neither key is set, returns a friendly setup message — the chat UI still
works end-to-end so you can wire up keys later without code changes.
"""
from __future__ import annotations

import json
import logging
import os
from typing import Any

import httpx
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_org_id, get_db
from app.modules.assistant.tools import TOOLS, execute_tool


log = logging.getLogger(__name__)

router = APIRouter(prefix="/assistant", tags=["assistant"])


SYSTEM_PROMPT = (
    "Siz Aniq ERP'ning yordamchi sun'iy intellektisiz. "
    "Foydalanuvchi savollariga o'zbek tilida javob bering. "
    "Real ma'lumot uchun mavjud tool'larni ishlatib so'rang. "
    "Javoblarni qisqa, aniq va konkret raqamlar bilan bering. "
    "Pul summalarini UZS valyutasida ko'rsating."
)


class ChatMessage(BaseModel):
    role: str  # 'user' | 'assistant'
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]


class ChatResponse(BaseModel):
    reply: str
    tool_calls: list[dict] = []
    provider: str  # 'anthropic' | 'openai' | 'none'


def _has_anthropic_key() -> bool:
    return bool(os.environ.get("ANTHROPIC_API_KEY"))


def _has_openai_key() -> bool:
    return bool(os.environ.get("OPENAI_API_KEY"))


@router.get("/status")
async def status():
    """Frontend uses this to decide whether to show a setup banner."""
    return {
        "anthropic_configured": _has_anthropic_key(),
        "openai_configured": _has_openai_key(),
        "tools_count": len(TOOLS),
        "tools": [t["name"] for t in TOOLS],
    }


@router.post("/chat", response_model=ChatResponse)
async def chat(
    req: ChatRequest,
    org_id: str = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_db),
):
    """Send a chat message to the AI assistant and get a reply."""
    if _has_anthropic_key():
        return await _chat_anthropic(req, db, org_id)
    if _has_openai_key():
        return await _chat_openai(req, db, org_id)

    # No API key — return helpful placeholder
    last_user = next((m for m in reversed(req.messages) if m.role == "user"), None)
    user_text = (last_user.content if last_user else "").lower()

    # Try to do a useful demo by running tools based on keywords
    demo_data: dict[str, Any] = {}
    if any(w in user_text for w in ["sotuv", "tushum", "savd", "revenue", "sales"]):
        demo_data["sales_summary"] = await execute_tool("get_sales_summary", db, org_id)
    if any(w in user_text for w in ["mijoz", "top", "customer"]):
        demo_data["top_customers"] = await execute_tool("get_top_customers", db, org_id)
    if any(w in user_text for w in ["mahsulot", "tovar", "product"]):
        demo_data["top_products"] = await execute_tool("get_top_products", db, org_id)
    if any(w in user_text for w in ["qoldiq", "ombor", "stock"]):
        demo_data["low_stock"] = await execute_tool("get_low_stock", db, org_id)
    if any(w in user_text for w in ["qarz", "debt"]):
        demo_data["debts"] = await execute_tool("get_customer_debts", db, org_id)
    if any(w in user_text for w in ["kassa", "balans", "cash"]):
        demo_data["cashboxes"] = await execute_tool("get_cashbox_balances", db, org_id)

    reply = (
        "🤖 <b>AI assistent demo rejimida</b>\n\n"
        "AI provider sozlanmagan. Real javoblar uchun .env faylida "
        "<code>ANTHROPIC_API_KEY</code> yoki <code>OPENAI_API_KEY</code> belgilang.\n\n"
    )
    if demo_data:
        reply += "Demo: kalit so'zlardan kelib chiqib quyidagi tool'lar chaqirildi:\n\n"
        reply += f"```json\n{json.dumps(demo_data, ensure_ascii=False, indent=2)}\n```"
    else:
        reply += "Sinab ko'ring: 'oxirgi 30 kunda sotuv qancha?', 'top mijozlar', 'past qoldiq'"

    return ChatResponse(
        reply=reply,
        tool_calls=[{"tool": k} for k in demo_data.keys()],
        provider="none",
    )


# -------------------------------------------------------------------------
# Anthropic Claude
# -------------------------------------------------------------------------

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"


async def _chat_anthropic(req: ChatRequest, db: AsyncSession, org_id: str) -> ChatResponse:
    """Call Claude with tool-use. Loops on tool results until final reply."""
    api_key = os.environ["ANTHROPIC_API_KEY"]
    model = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-6")

    # Convert messages to Anthropic format
    messages: list[dict] = [
        {"role": m.role, "content": m.content} for m in req.messages
    ]

    tool_calls_log: list[dict] = []

    async with httpx.AsyncClient(timeout=60) as c:
        # Tool-use loop (max 5 iterations to avoid runaway)
        for _ in range(5):
            r = await c.post(
                ANTHROPIC_URL,
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": model,
                    "max_tokens": 1024,
                    "system": SYSTEM_PROMPT,
                    "messages": messages,
                    "tools": TOOLS,
                },
            )
            if r.status_code >= 400:
                return ChatResponse(reply=f"Anthropic xato: {r.text[:200]}",
                                    provider="anthropic")
            data = r.json()
            content = data.get("content", [])

            # Collect tool_use blocks; if any, execute and continue
            tool_uses = [b for b in content if b.get("type") == "tool_use"]
            if not tool_uses:
                # Final text reply
                texts = [b.get("text", "") for b in content if b.get("type") == "text"]
                return ChatResponse(reply="\n".join(texts).strip() or "(bo'sh javob)",
                                    tool_calls=tool_calls_log, provider="anthropic")

            # Execute tools and append results
            messages.append({"role": "assistant", "content": content})
            tool_results = []
            for tu in tool_uses:
                tname = tu["name"]
                targs = tu.get("input", {}) or {}
                result = await execute_tool(tname, db, org_id, **targs)
                tool_calls_log.append({"tool": tname, "args": targs})
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": tu["id"],
                    "content": json.dumps(result, ensure_ascii=False, default=str),
                })
            messages.append({"role": "user", "content": tool_results})

        return ChatResponse(reply="(tool-use loop limiti)",
                            tool_calls=tool_calls_log, provider="anthropic")


# -------------------------------------------------------------------------
# OpenAI
# -------------------------------------------------------------------------

OPENAI_URL = "https://api.openai.com/v1/chat/completions"


async def _chat_openai(req: ChatRequest, db: AsyncSession, org_id: str) -> ChatResponse:
    """Call OpenAI with function calling."""
    api_key = os.environ["OPENAI_API_KEY"]
    model = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")

    messages: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]
    for m in req.messages:
        messages.append({"role": m.role, "content": m.content})

    openai_tools = [{
        "type": "function",
        "function": {
            "name": t["name"],
            "description": t["description"],
            "parameters": t["input_schema"],
        },
    } for t in TOOLS]

    tool_calls_log: list[dict] = []

    async with httpx.AsyncClient(timeout=60) as c:
        for _ in range(5):
            r = await c.post(
                OPENAI_URL,
                headers={"Authorization": f"Bearer {api_key}",
                         "Content-Type": "application/json"},
                json={"model": model, "messages": messages,
                      "tools": openai_tools, "tool_choice": "auto"},
            )
            if r.status_code >= 400:
                return ChatResponse(reply=f"OpenAI xato: {r.text[:200]}",
                                    provider="openai")
            data = r.json()
            msg = data["choices"][0]["message"]
            messages.append(msg)

            tool_calls = msg.get("tool_calls") or []
            if not tool_calls:
                return ChatResponse(reply=msg.get("content") or "(bo'sh javob)",
                                    tool_calls=tool_calls_log, provider="openai")

            for tc in tool_calls:
                fn = tc["function"]
                tname = fn["name"]
                try:
                    targs = json.loads(fn.get("arguments") or "{}")
                except json.JSONDecodeError:
                    targs = {}
                result = await execute_tool(tname, db, org_id, **targs)
                tool_calls_log.append({"tool": tname, "args": targs})
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "content": json.dumps(result, ensure_ascii=False, default=str),
                })

        return ChatResponse(reply="(tool-use loop limiti)",
                            tool_calls=tool_calls_log, provider="openai")
