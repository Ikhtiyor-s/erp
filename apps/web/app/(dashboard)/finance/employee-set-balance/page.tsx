"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function EmployeeSetBalanceRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/finance/set-balance?tab=employee");
  }, [router]);
  return null;
}
