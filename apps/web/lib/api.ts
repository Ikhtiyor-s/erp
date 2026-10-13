import axios, { type InternalAxiosRequestConfig } from "axios";

type RetriableConfig = InternalAxiosRequestConfig & { _retriedAfterRefresh?: boolean };

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

function logoutAndRedirect() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  const isMobile = window.location.pathname.startsWith("/m");
  const loginPath = isMobile ? "/m/login" : "/login";
  if (!window.location.pathname.startsWith(loginPath)) {
    window.location.href = loginPath;
  }
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem("refresh_token");
  if (!refreshToken) return null;
  try {
    const { data } = await axios.post(`${resolveBaseUrl()}/auth/refresh`, {
      refresh_token: refreshToken,
    });
    localStorage.setItem("access_token", data.access_token);
    localStorage.setItem("refresh_token", data.refresh_token);
    return data.access_token as string;
  } catch {
    return null;
  }
}

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const config = error?.config as RetriableConfig | undefined;
    const status = error?.response?.status;

    if (typeof window === "undefined" || status !== 401 || !config) {
      return Promise.reject(error);
    }
    // Login/register/refresh 401ing (wrong password, dead refresh token, ...)
    // are real failures, not a stale-access-token case — don't try to refresh.
    const isAuthBootstrapCall = /\/auth\/(login|register|refresh)(\/|$|\?)/.test(config.url ?? "");
    if (isAuthBootstrapCall || config._retriedAfterRefresh) {
      logoutAndRedirect();
      return Promise.reject(error);
    }
    config._retriedAfterRefresh = true;

    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }
    const newAccessToken = await refreshPromise;
    if (!newAccessToken) {
      logoutAndRedirect();
      return Promise.reject(error);
    }
    return api(config);
  },
);
