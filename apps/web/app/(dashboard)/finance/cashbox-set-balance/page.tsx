"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CashboxSetBalanceRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/finance/set-balance?tab=cashbox");
  }, [router]);
  return null;
}
