"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LegacySupplierBalance() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/finance/balances?tab=supplier");
  }, [router]);
  return <div className="p-6 text-slate-500">Redirecting...</div>;
}
