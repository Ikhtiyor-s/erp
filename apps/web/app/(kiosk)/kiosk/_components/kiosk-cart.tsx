"use client";

// In-flow cart state for the (kiosk) route group — shared across /kiosk and
// /kiosk/pay via this layout-level provider, same "context survives
// client-side navigation within a route group" shape (shop)/layout.tsx's
// CartProvider already uses for the storefront. Independent implementation,
// not imported from there (DESIGN-self-checkout-auth.md: pattern reused,
// business logic not shared).

import { createContext, useContext, useMemo, useState } from "react";
import type { KioskProduct } from "@/lib/kiosk-api";

export type KioskCartItem = {
  product_id: string;
  name: string;
  price: number;
  currency_code: string | null;
  quantity: number;
};

type Ctx = {
  items: KioskCartItem[];
  totalQty: number;
  totalAmount: number;
  addProduct: (p: KioskProduct) => void;
  changeQty: (productId: string, delta: number) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
};

const KioskCartContext = createContext<Ctx | null>(null);

export function useKioskCart(): Ctx {
  const ctx = useContext(KioskCartContext);
  if (!ctx) throw new Error("useKioskCart must be used within KioskCartProvider");
  return ctx;
}

export function KioskCartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<KioskCartItem[]>([]);

  function addProduct(p: KioskProduct) {
    setItems((cur) => {
      const existing = cur.find((it) => it.product_id === p.id);
      if (existing) {
        return cur.map((it) => (it.product_id === p.id ? { ...it, quantity: it.quantity + 1 } : it));
      }
      return [...cur, { product_id: p.id, name: p.name, price: p.price, currency_code: p.currency_code, quantity: 1 }];
    });
  }

  function changeQty(productId: string, delta: number) {
    setItems((cur) =>
      cur
        .map((it) => (it.product_id === productId ? { ...it, quantity: Math.max(0, it.quantity + delta) } : it))
        .filter((it) => it.quantity > 0),
    );
  }

  function removeItem(productId: string) {
    setItems((cur) => cur.filter((it) => it.product_id !== productId));
  }

  function clear() {
    setItems([]);
  }

  const totalQty = useMemo(() => items.reduce((s, it) => s + it.quantity, 0), [items]);
  const totalAmount = useMemo(() => items.reduce((s, it) => s + it.quantity * it.price, 0), [items]);

  return (
    <KioskCartContext.Provider value={{ items, totalQty, totalAmount, addProduct, changeQty, removeItem, clear }}>
      {children}
    </KioskCartContext.Provider>
  );
}
