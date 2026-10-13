"use client";

// Independent client-side cart store for the anonymous B2C storefront.
// Mirrors the (portal) cart's Context + add/increment/decrement/remove shape
// (see app/(portal)/portal/_components/cart.tsx) but is a separate
// implementation: no auth token to attach, no single-page submit() — this
// cart must survive navigation across /shop, /shop/[productId], /shop/cart
// and /shop/checkout, so it's mounted once in (shop)/layout.tsx and persisted
// to localStorage (the portal cart only lived in-memory inside one page).

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ShopProduct } from "@/lib/shop-api";

const CART_STORAGE_KEY = "shop_cart_v1";

export type ShopCartItem = {
  product_id: string;
  name: string;
  price: number;
  currency_code: string;
  image_url: string | null;
  quantity: number;
};

type StoredCart = { items: ShopCartItem[]; notes: string };

type CartContextValue = {
  items: ShopCartItem[];
  addItem: (product: ShopProduct, qty?: number) => void;
  increment: (productId: string) => void;
  decrement: (productId: string) => void;
  remove: (productId: string) => void;
  clear: () => void;
  totalQty: number;
  totalAmount: number;
  notes: string;
  setNotes: (v: string) => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

function loadStoredCart(): StoredCart {
  if (typeof window === "undefined") return { items: [], notes: "" };
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return { items: [], notes: "" };
    const parsed = JSON.parse(raw);
    return {
      items: Array.isArray(parsed?.items) ? parsed.items : [],
      notes: typeof parsed?.notes === "string" ? parsed.notes : "",
    };
  } catch {
    return { items: [], notes: "" };
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ShopCartItem[]>([]);
  const [notes, setNotesState] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = loadStoredCart();
    setItems(stored.items);
    setNotesState(stored.notes);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ items, notes }));
  }, [items, notes, hydrated]);

  const addItem = useCallback((product: ShopProduct, qty = 1) => {
    if (product.stock_status === "out_of_stock" || qty <= 0) return;
    setItems((prev) => {
      const existing = prev.find((it) => it.product_id === product.id);
      if (existing) {
        return prev.map((it) =>
          it.product_id === product.id ? { ...it, quantity: it.quantity + qty } : it,
        );
      }
      return [
        ...prev,
        {
          product_id: product.id,
          name: product.name,
          price: product.price,
          currency_code: product.currency_code,
          image_url: product.image_url,
          quantity: qty,
        },
      ];
    });
  }, []);

  const changeQty = useCallback((productId: string, delta: number) => {
    setItems((prev) =>
      prev
        .map((it) =>
          it.product_id === productId ? { ...it, quantity: Math.max(0, it.quantity + delta) } : it,
        )
        .filter((it) => it.quantity > 0),
    );
  }, []);

  const increment = useCallback((id: string) => changeQty(id, 1), [changeQty]);
  const decrement = useCallback((id: string) => changeQty(id, -1), [changeQty]);
  const remove = useCallback(
    (id: string) => setItems((prev) => prev.filter((it) => it.product_id !== id)),
    [],
  );
  const clear = useCallback(() => {
    setItems([]);
    setNotesState("");
  }, []);
  const setNotes = useCallback((v: string) => setNotesState(v), []);

  const totalQty = useMemo(() => items.reduce((s, it) => s + it.quantity, 0), [items]);
  const totalAmount = useMemo(() => items.reduce((s, it) => s + it.price * it.quantity, 0), [items]);

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
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
