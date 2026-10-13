"use client";

// Resolves which organization the anonymous /shop storefront belongs to.
//
// DESIGN-ecommerce-b2c.md freezes `org_code` as a required request param on
// every /shop/* call but does not freeze how the frontend obtains it (no
// subdomain/slug convention exists anywhere else in this codebase — grepped
// `org_code`/`subdomain` in apps/web, only hit is the (portal) OTP login's
// plain text input). Chosen approach, flagged per the ticket: a `?org=<code>`
// query param, persisted to localStorage so it survives client-side
// navigation across /shop/* pages without needing to be repeated on every
// link, falling back to a single hardcoded demo org code when neither is
// present (same "ANIQ" default the (portal) login page ships with).

import { useEffect, useState } from "react";

const SHOP_ORG_STORAGE_KEY = "shop_org_code";
export const SHOP_DEFAULT_ORG_CODE = "ANIQ";

// Reads window.location.search directly instead of next/navigation's
// useSearchParams(): these /shop/* pages have no dynamic route segment, so
// Next tries to statically prerender them at build time, and useSearchParams
// forces a Suspense boundary requirement there (missing-suspense-with-csr-
// bailout) — not worth the ceremony for a value that's 100% client-resolved
// anyway. Same "render default first, resolve for real in an effect" shape
// LocaleProvider already uses to dodge hydration mismatches.
export function useShopOrgCode(): string {
  const [orgCode, setOrgCode] = useState(SHOP_DEFAULT_ORG_CODE);

  useEffect(() => {
    const queryOrg = new URLSearchParams(window.location.search).get("org");
    if (queryOrg) {
      const code = queryOrg.toUpperCase();
      localStorage.setItem(SHOP_ORG_STORAGE_KEY, code);
      setOrgCode(code);
      return;
    }
    const saved = localStorage.getItem(SHOP_ORG_STORAGE_KEY);
    setOrgCode(saved || SHOP_DEFAULT_ORG_CODE);
  }, []);

  return orgCode;
}

/** Keep `org` carried across internal /shop links once it's non-default. */
export function appendOrgParam(path: string, orgCode: string): string {
  if (!orgCode || orgCode === SHOP_DEFAULT_ORG_CODE) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}org=${encodeURIComponent(orgCode)}`;
}
