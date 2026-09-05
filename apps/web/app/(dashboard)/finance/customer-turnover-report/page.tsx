"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CustomerTurnoverPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/finance/turnover?tab=customer");
  }, [router]);
  return null;
}
