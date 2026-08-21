"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";

export type PermissionsCtx = {
  loading: boolean;
  role: { code: string | null; name: string | null };
  permissions: Set<string>;
  isSuperadmin: boolean;
  can: (code: string) => boolean;
  canAny: (...codes: string[]) => boolean;
  reload: () => Promise<void>;
};

const Ctx = createContext<PermissionsCtx>({
  loading: true,
  role: { code: null, name: null },
  permissions: new Set(),
  isSuperadmin: false,
  can: () => false,
  canAny: () => false,
  reload: async () => {},
});

export const usePermissions = () => useContext(Ctx);

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<{ code: string | null; name: string | null }>({
    code: null,
    name: null,
  });
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [isSuperadmin, setIsSuperadmin] = useState(false);

  async function reload() {
    setLoading(true);
    try {
      const { data } = await api.get<{
        role: { code: string | null; name: string | null };
        permissions: string[];
        is_superadmin: boolean;
      }>("/rbac/me/permissions");
      setRole(data.role);
      setPermissions(new Set(data.permissions));
      setIsSuperadmin(data.is_superadmin);
    } catch {
      setRole({ code: null, name: null });
      setPermissions(new Set());
      setIsSuperadmin(false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Only fetch if we have a token (otherwise login page is shown)
    if (typeof window !== "undefined" && localStorage.getItem("access_token")) {
      reload();
    } else {
      setLoading(false);
    }
  }, []);

  const can = (code: string) => isSuperadmin || permissions.has(code);
  const canAny = (...codes: string[]) =>
    isSuperadmin || codes.some((c) => permissions.has(c));

  return (
    <Ctx.Provider value={{ loading, role, permissions, isSuperadmin, can, canAny, reload }}>
      {children}
    </Ctx.Provider>
  );
}
