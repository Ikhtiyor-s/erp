import { api } from "./api";

export async function login(email: string, password: string) {
  const { data } = await api.post("/auth/login", { email, password });
  localStorage.setItem("access_token", data.access_token);
  localStorage.setItem("refresh_token", data.refresh_token);
  return data;
}

export async function register(payload: {
  email: string;
  password: string;
  full_name: string;
  organization_name: string;
}) {
  const { data } = await api.post("/auth/register", payload);
  localStorage.setItem("access_token", data.access_token);
  localStorage.setItem("refresh_token", data.refresh_token);
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
