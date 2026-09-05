"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CustomerSetBalanceRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/finance/set-balance?tab=customer");
  }, [router]);
  return null;
}
