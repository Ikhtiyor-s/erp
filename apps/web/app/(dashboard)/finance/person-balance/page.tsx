"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LegacyPersonBalance() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/finance/balances?tab=person");
  }, [router]);
  return <div className="p-6 text-slate-500">Redirecting...</div>;
}
