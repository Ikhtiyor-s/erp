"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Package } from "lucide-react";
import { api } from "@/lib/api";

const fmt = (v: any) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

export default function MobileProducts() {
  const router = useRouter();
  useEffect(() => { router.replace("/m/warehouse"); }, [router]);
  return null;
}
