import axios from "axios";

function resolveBaseUrl(): string {
  if (typeof window !== "undefined") {
    // Mobile (PWA) — use same-origin rewrite so ngrok / HTTPS works with single URL
    if (window.location.pathname.startsWith("/m")) {
      return `${window.location.origin}/api/v1`;
    }
    // Desktop — prefer build-time bake; fall back to host:8001
    const baked = process.env.NEXT_PUBLIC_API_URL;
    if (baked) return baked;
    return `${window.location.protocol}//${window.location.hostname}:8001/api/v1`;
  }
  // SSR
  const baked = process.env.NEXT_PUBLIC_API_URL;
  if (baked) return baked;
  return "http://api:8000/api/v1";
}

export const api = axios.create({
  baseURL: resolveBaseUrl(),
  withCredentials: false,
  // H5: 20s default timeout. Per-call override via { timeout: ms } when needed
  // (e.g. file upload). Without this, slow API hangs UI forever.
  timeout: 20000,
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    const orgId = localStorage.getItem("org_id");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    if (orgId) config.headers["X-Organization-Id"] = orgId;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error?.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      const isMobile = window.location.pathname.startsWith("/m");
      const loginPath = isMobile ? "/m/login" : "/login";
      if (!window.location.pathname.startsWith(loginPath)) {
        window.location.href = loginPath;
      }
    }
    return Promise.reject(error);
  },
);
