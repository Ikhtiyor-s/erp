"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CashboxTurnoverPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/finance/turnover?tab=cashbox");
  }, [router]);
  return null;
}
