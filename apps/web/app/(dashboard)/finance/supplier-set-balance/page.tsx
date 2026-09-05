"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SupplierSetBalanceRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/finance/set-balance?tab=supplier");
  }, [router]);
  return null;
}
