"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LegacyEmployeeBalance() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/finance/balances?tab=employee");
  }, [router]);
  return <div className="p-6 text-ink-500">Redirecting...</div>;
}
