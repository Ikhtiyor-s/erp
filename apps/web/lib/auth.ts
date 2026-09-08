import { api } from "./api";

// Fetch user's orgs and persist the first one as active so that api.ts
// interceptor can attach X-Organization-Id on the very first request after
// login. Without this, PermissionsProvider races Topbar and calls
// /rbac/me/permissions before org_id is set, returning 400 and leaving the
// sidebar empty until a manual refresh.
async function ensureOrgId(): Promise<void> {
  try {
    const { data: orgs } = await api.get<Array<{ id: string }>>("/organizations/mine");
    if (Array.isArray(orgs) && orgs.length > 0 && !localStorage.getItem("org_id")) {
      localStorage.setItem("org_id", orgs[0].id);
    }
  } catch {
    // Non-fatal: dashboard will fetch orgs itself; user just loses sidebar
    // until refresh (pre-fix behavior).
  }
}

export async function login(phone: string, password: string) {
  const { data } = await api.post("/auth/login", { phone, password });
  localStorage.setItem("access_token", data.access_token);
  localStorage.setItem("refresh_token", data.refresh_token);
  if (data.user) localStorage.setItem("user", JSON.stringify(data.user));
  await ensureOrgId();
  if (!data.user) {
    try {
      const me = await fetchMe();
      if (me) localStorage.setItem("user", JSON.stringify(me));
    } catch {}
  }
  return data;
}

export async function requestRegisterOtp(phone: string) {
  const { data } = await api.post("/auth/register/request-otp", { phone });
  return data as { ok: boolean; message: string; dev_code?: string; dev_note?: string };
}

export async function verifyRegisterOtp(phone: string, code: string) {
  const { data } = await api.post("/auth/register/verify-otp", { phone, code });
  return data as { verified: boolean; ticket: string };
}

export async function register(payload: {
  ticket: string;
  phone: string;
  password: string;
  full_name: string;
  organization_name: string;
}) {
  const { data } = await api.post("/auth/register", payload);
  localStorage.setItem("access_token", data.access_token);
  localStorage.setItem("refresh_token", data.refresh_token);
  if (data.user) localStorage.setItem("user", JSON.stringify(data.user));
  await ensureOrgId();
  if (!data.user) {
    try {
      const me = await fetchMe();
      if (me) localStorage.setItem("user", JSON.stringify(me));
    } catch {}
  }
  return data;
}

export async function fetchMe() {
  const { data } = await api.get("/auth/me");
  return data;
}

export async function fetchMyOrgs() {
  const { data } = await api.get("/organizations/mine");
  return data;
}

export function logout() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("org_id");
  window.location.href = "/login";
}
