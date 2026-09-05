export type IntegrationStatus =
  | "not_configured"
  | "configured"
  | "active"
  | "error";

export type IntegrationCategory =
  | "payment"
  | "delivery"
  | "e_invoice"
  | "accounting"
  | "communication"
  | "tools";

export interface IntegrationInfo {
  code: string;
  name: string;
  category: IntegrationCategory;
  description: string;
  enabled: boolean;
  credentials_required: boolean;
  configured: boolean;
  status: IntegrationStatus;
}

export interface IntegrationConfig {
  code: string;
  name: string;
  category: IntegrationCategory;
  enabled: boolean;
  credentials_required: boolean;
  configured: boolean;
  config: Record<string, string>;
}

export interface TestResult {
  ok: boolean;
  message: string;
  latency_ms: number | null;
}

export interface StatusMap {
  [code: string]: IntegrationStatus;
}
