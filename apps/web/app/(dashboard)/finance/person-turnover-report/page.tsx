"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PersonTurnoverPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/finance/turnover?tab=person");
  }, [router]);
  return null;
}
