"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PersonSetBalanceRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/finance/set-balance?tab=person");
  }, [router]);
  return null;
}
