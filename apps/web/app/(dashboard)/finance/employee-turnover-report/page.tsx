"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function EmployeeTurnoverPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/finance/turnover?tab=employee");
  }, [router]);
  return null;
}
