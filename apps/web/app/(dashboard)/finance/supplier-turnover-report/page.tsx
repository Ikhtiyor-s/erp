"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SupplierTurnoverPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/finance/turnover?tab=supplier");
  }, [router]);
  return null;
}
