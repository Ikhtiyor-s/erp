"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LegacyCustomerBalance() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/finance/balances?tab=customer");
  }, [router]);
  return <div className="p-6 text-slate-500">Redirecting...</div>;
}
