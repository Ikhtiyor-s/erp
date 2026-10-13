"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { getPortalToken } from "../../portal-auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001/api/v1";

export type CartItem = {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
};

export type CartSubmitResult = {
  id: string;
  order_number: string;
  total: number;
  status: string;
};

type AddableProduct = {
  id: string;
  name: string;
  price: number;
  in_stock: boolean;
};

type CartContextValue = {
  items: CartItem[];
  addItem: (product: AddableProduct) => void;
  increment: (productId: string) => void;
  decrement: (productId: string) => void;
  remove: (productId: string) => void;
  clear: () => void;
  totalQty: number;
  totalAmount: number;
  notes: string;
  setNotes: (v: string) => void;
  submitting: boolean;
  submitError: string | null;
  submit: () => Promise<CartSubmitResult>;
};

const CartContext = createContext<CartContextValue | null>(null);

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

function newIdempotencyKey(): string {
  return crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);
}

async function postOrder(
  token: string | null,
  items: CartItem[],
  notes: string,
  idempotencyKey: string,
) {
  const res = await fetch(`${API_BASE}/customer-portal/me/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      items: items.map((it) => ({ product_id: it.product_id, quantity: it.quantity })),
      notes: notes || null,
    }),
    signal: AbortSignal.timeout(20000),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = typeof data?.detail === "string" ? data.detail : null;
    throw new Error(detail || `Server xatosi (${res.status})`);
  }
  return data as CartSubmitResult;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const addItem = useCallback((product: AddableProduct) => {
    if (!product.in_stock) return;
    setItems((prev) => {
      const existing = prev.find((it) => it.product_id === product.id);
      if (existing) {
        return prev.map((it) =>
          it.product_id === product.id ? { ...it, quantity: it.quantity + 1 } : it
        );
      }
      return [...prev, { product_id: product.id, name: product.name, price: product.price, quantity: 1 }];
    });
  }, []);

  const changeQty = useCallback((productId: string, delta: number) => {
    setItems((prev) =>
      prev
        .map((it) =>
          it.product_id === productId ? { ...it, quantity: Math.max(0, it.quantity + delta) } : it
        )
        .filter((it) => it.quantity > 0)
    );
  }, []);

  const increment = useCallback((productId: string) => changeQty(productId, 1), [changeQty]);
  const decrement = useCallback((productId: string) => changeQty(productId, -1), [changeQty]);

  const remove = useCallback((productId: string) => {
    setItems((prev) => prev.filter((it) => it.product_id !== productId));
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    setNotes("");
  }, []);

  const totalQty = useMemo(() => items.reduce((s, it) => s + it.quantity, 0), [items]);
  const totalAmount = useMemo(() => items.reduce((s, it) => s + it.price * it.quantity, 0), [items]);

  const submit = useCallback(async (): Promise<CartSubmitResult> => {
    if (items.length === 0) throw new Error("Savat bo'sh");
    setSubmitting(true);
    setSubmitError(null);
    const token = getPortalToken();
    const idempotencyKey = newIdempotencyKey();
    try {
      let result: CartSubmitResult;
      try {
        result = await postOrder(token, items, notes, idempotencyKey);
      } catch (firstErr: any) {
        if (firstErr instanceof TypeError || firstErr?.name === "TimeoutError") {
          result = await postOrder(token, items, notes, idempotencyKey);
        } else {
          throw firstErr;
        }
      }
      clear();
      return result;
    } catch (e: any) {
      const message = e?.message || "Xatolik yuz berdi";
      setSubmitError(message);
      throw e;
    } finally {
      setSubmitting(false);
    }
  }, [items, notes, clear]);

  const value: CartContextValue = {
    items,
    addItem,
    increment,
    decrement,
    remove,
    clear,
    totalQty,
    totalAmount,
    notes,
    setNotes,
    submitting,
    submitError,
    submit,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
