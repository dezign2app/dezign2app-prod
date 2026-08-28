import type { UIEventItem, PageSection, Parameter, Schema } from "./simulation";
import type { WebAppZone, ProtectionRule, PaymentsPlanConfig } from "./auth";

export type SectionIconName =
  | "layout-grid"
  | "table"
  | "form-input"
  | "message-square"
  | "bar-chart-3"
  | "box"
  | "sparkles"
  | "package";

export interface SectionPreset {
  id?: string;
  label: string;
  iconName?: SectionIconName;
  desc: string;
  renderMode: "server" | "client";
  loadStrategy: "eager" | "dynamic" | "dynamic-no-ssr";
  libraries: string[];
  defaultActions: { name: string; event: string }[];
  defaultDesc: string;
  defaultUiPrompt: string;
}

export interface CategorizedLibrary {
  category: string;
  iconName?: SectionIconName;
  libs: string[];
}

export interface PresetTriggerOption {
  value: string;
  label: string;
  defaultRoute: string;
}

/** WebApp node fields (canvas type). */
export interface CanvasWebAppNodeData {
  appSlug?: string;
  framework?: string;
  port?: string | number;
  routes?: Array<{
    id: string;
    name: string;
    path: string;
    accessType?: "public" | "private" | "role-gated" | "payment-gated" | "org-gated";
    allowedRoles?: string[];
    requiredPlans?: string[];
    allowedOrgRoles?: string[];
    redirectTo?: string;
    isAuthPage?: boolean;
    events?: UIEventItem[];
  }>;
  zones?: WebAppZone[];
  authMode?: "none" | "connected_auth_node" | "custom_jwt" | "better_auth";
  authNodeId?: string;
  defaultLoginRoute?: string;
  corsOrigins?: string;
}

/** Web Page node fields (canvas type). */
export interface CanvasWebPageNodeData {
  appName?: string;
  appSlug?: string;
  accessType?: "public" | "private" | "role-gated" | "payment-gated" | "org-gated";
  allowedRoles?: string[];
  requiredPlans?: string[];
  allowedOrgRoles?: string[];
  redirectTo?: string;
  isAuthPage?: boolean;
  authNodeId?: string;
  zoneId?: string;
  useZoneDefault?: boolean;
  protectionOverride?: ProtectionRule;
  events?: UIEventItem[];
  sections?: PageSection[];
  uiPrompt?: string;
  renderMode?: "server" | "client";
  headers?: Parameter[];
  pathParams?: Parameter[];
  queryParams?: Parameter[];
  requestBody?: Schema;
  requestBodyMode?: "field_builder" | "raw_json";
  summary?: string;
  requireAuth?: boolean;
}

/** Payments node fields (canvas type). */
export interface CanvasPaymentsNodeData {
  provider?: "creem" | string;
  plans?: PaymentsPlanConfig[];
  eventMapping?: Record<string, "active" | "trialing" | "past_due" | "canceled" | "expired">;
  apiKeyEnv?: string;
  webhookSecretEnv?: string;
}

/** Page Reference node fields (canvas type). */
export interface CanvasPageRefNodeData {
  pageRefId?: string;
  targetPageId?: string;
  targetPageLabel?: string;
  targetPageSlug?: string;
}

/** Hook node fields for canvas graph view. */
export interface CanvasHookNodeData {
  hookName?: string;
  scope?: "global" | "local";
  targetWebAppId?: string;
  targetPageId?: string;
  targetEndpointId?: string;
  targetEventId?: string;
  hookRef?: string;
  hookType?: "query" | "mutation" | "subscription" | "custom";
  inputParams?: Parameter[];
  returnSchema?: Parameter[];
  logicMode?: "natural_language" | "code";
  prompt?: string;
  code?: string;
}

/** Hook reference node fields (canvas type). */
export interface CanvasHookRefNodeData {
  hookRef?: string;
  targetWebAppId?: string;
  targetPageId?: string;
  targetPageIds?: string[];
}
