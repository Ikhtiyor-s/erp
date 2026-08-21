"use client";

/**
 * Customer portal auth helpers — kept outside layout.tsx because
 * Next.js layouts may only export `default` + metadata + viewport.
 */

const PORTAL_TOKEN_KEY = "portal_token";
const PORTAL_CUSTOMER_KEY = "portal_customer";
const PORTAL_ORG_KEY = "portal_org_code";

export function setPortalAuth(token: string, customer: any, orgCode: string) {
  localStorage.setItem(PORTAL_TOKEN_KEY, token);
  localStorage.setItem(PORTAL_CUSTOMER_KEY, JSON.stringify(customer));
  localStorage.setItem(PORTAL_ORG_KEY, orgCode);
}

export function clearPortalAuth() {
  localStorage.removeItem(PORTAL_TOKEN_KEY);
  localStorage.removeItem(PORTAL_CUSTOMER_KEY);
  localStorage.removeItem(PORTAL_ORG_KEY);
}

export function getPortalToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(PORTAL_TOKEN_KEY);
}

export function getPortalCustomer(): any {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(PORTAL_CUSTOMER_KEY);
  return v ? JSON.parse(v) : null;
}
