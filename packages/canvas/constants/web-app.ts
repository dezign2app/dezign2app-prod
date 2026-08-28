import type { WebAppZone, RedirectMap } from "../types/auth";
import type { SectionPreset, CategorizedLibrary, PresetTriggerOption } from "../types/web-app";
import type { BackendNode } from "../types/nodes";
import type { Endpoint } from "../schemas/endpoints";
import { WEB_PAGE_EVENTS } from "../graph-rules";

export { WEB_PAGE_EVENTS };
export const EVENT_OPTIONS = WEB_PAGE_EVENTS;

export const SERVER_NODE_TYPES = [
  "service",
  "gateway",
  "serverless",
  "langgraph",
  "worker",
  "external",
];

export const DEFAULT_REDIRECTS: RedirectMap = {
  "no-auth": "/login",
  "no-org": "/select-org",
  "wrong-role": "/unauthorized",
  "no-access": "/pricing",
  "wrong-plan": "/pricing",
  default: "/login",
};

export const DEFAULT_ZONES: WebAppZone[] = [
  {
    id: "zone-public",
    name: "Public Section",
    handleId: "public-in",
    accessType: "public",
    hasLayout: true,
    layoutDescription: "Public layout with top navigation bar, logo, and auth links",
    rule: {
      id: "rule-public",
      scope: "zone",
      conditions: { kind: "leaf", condition: { type: "auth", op: "signedOut" } },
      redirects: { ...DEFAULT_REDIRECTS },
    },
  },
  {
    id: "zone-private",
    name: "Private Section",
    handleId: "private-in",
    accessType: "protected",
    hasLayout: true,
    layoutDescription: "Protected app layout with sidebar navigation, user profile, and session check",
    rule: {
      id: "rule-private",
      scope: "zone",
      conditions: { kind: "leaf", condition: { type: "auth", op: "signedIn" } },
      redirects: { ...DEFAULT_REDIRECTS },
    },
  },
];

export const PRESET_TRIGGER_OPTIONS: PresetTriggerOption[] = [
  { value: "no-auth", label: "Unauthenticated (no-auth)", defaultRoute: "/login" },
  { value: "no-org", label: "No Organization (no-org)", defaultRoute: "/select-org" },
  { value: "wrong-role", label: "Insufficient Role (wrong-role)", defaultRoute: "/unauthorized" },
  { value: "no-access", label: "No Paid Access (no-access)", defaultRoute: "/pricing" },
  { value: "wrong-plan", label: "Plan Upgrade Needed (wrong-plan)", defaultRoute: "/pricing" },
  { value: "custom-denied", label: "Custom Logic Denied (custom-denied)", defaultRoute: "/login" },
  { value: "default", label: "Default Fallback Redirect", defaultRoute: "/login" },
];

export const CATEGORIZED_LIBRARIES: CategorizedLibrary[] = [
  {
    category: "UI & Icons",
    iconName: "sparkles",
    libs: ["lucide-react", "framer-motion", "@radix-ui/react-icons", "clsx", "tailwind-merge"],
  },
  {
    category: "Data & Tables",
    iconName: "table",
    libs: ["@tanstack/react-table", "@tanstack/react-query", "zod", "date-fns"],
  },
  {
    category: "Canvas & 3D",
    iconName: "box",
    libs: ["@xyflow/react", "tldraw", "three", "@react-three/fiber"],
  },
  {
    category: "Charts & Viz",
    iconName: "bar-chart-3",
    libs: ["recharts", "chart.js"],
  },
  {
    category: "State & Utilities",
    iconName: "package",
    libs: ["zustand", "lodash-es"],
  },
];

export const SECTION_PRESETS: SectionPreset[] = [
  {
    id: "hero",
    label: "Hero Banner",
    iconName: "layout-grid",
    desc: "Header with title, call-to-action buttons, and value propositions.",
    renderMode: "server",
    loadStrategy: "eager",
    libraries: ["lucide-react", "framer-motion"],
    defaultActions: [
      { name: "onGetStarted", event: "click" },
      { name: "onExploreDocs", event: "click" },
    ],
    defaultDesc: "Main landing hero section with headline, sub-headline, and primary action buttons.",
    defaultUiPrompt: "Sleek hero section with gradient typography, frosted glass background card, and glowing CTA buttons.",
  },
  {
    id: "data-table",
    label: "Data Table / Grid",
    iconName: "table",
    desc: "Interactive data grid with column sorting, pagination, and row actions.",
    renderMode: "client",
    loadStrategy: "dynamic",
    libraries: ["@tanstack/react-table", "lucide-react", "zod"],
    defaultActions: [
      { name: "onRowSelect", event: "click" },
      { name: "onFilterChange", event: "change" },
      { name: "onExportData", event: "click" },
    ],
    defaultDesc: "High-performance tabular data viewer with search filtering and paginated query results.",
    defaultUiPrompt: "Modern dark themed data table with sticky headers, zebra rows, search bar, and badge status columns.",
  },
  {
    id: "form-submit",
    label: "Form & Submit",
    iconName: "form-input",
    desc: "Input form with validation, submit handling, and error states.",
    renderMode: "client",
    loadStrategy: "eager",
    libraries: ["zod", "lucide-react"],
    defaultActions: [
      { name: "onSubmitForm", event: "submit" },
      { name: "onResetForm", event: "click" },
    ],
    defaultDesc: "Structured input form handling user submissions with client-side Zod validation.",
    defaultUiPrompt: "Clean card with floating labels, responsive multi-column layout, and loading spinner on submit button.",
  },
  {
    id: "realtime-feed",
    label: "Real-Time Feed / Chat",
    iconName: "message-square",
    desc: "Streaming live updates via SSE or WebSocket with message composer.",
    renderMode: "client",
    loadStrategy: "dynamic",
    libraries: ["lucide-react", "date-fns"],
    defaultActions: [
      { name: "onReceiveUpdate", event: "sse" },
      { name: "onSendMessage", event: "submit" },
    ],
    defaultDesc: "Live streaming event feed displaying real-time updates and notifications.",
    defaultUiPrompt: "Dark chat message stream with auto-scrolling container, message bubbles, and bottom action bar.",
  },
  {
    id: "kpi-metrics",
    label: "KPI Metrics & Charts",
    iconName: "bar-chart-3",
    desc: "Metric statistic cards with interactive charts and timeframe toggles.",
    renderMode: "client",
    loadStrategy: "dynamic",
    libraries: ["recharts", "lucide-react"],
    defaultActions: [
      { name: "onTimeframeChange", event: "change" },
      { name: "onRefreshMetrics", event: "click" },
    ],
    defaultDesc: "Summary dashboard metrics showing KPI stat cards and visual trend charts.",
    defaultUiPrompt: "Responsive 4-column metric cards with sparklines, percentage change indicators, and interactive area chart.",
  },
  {
    id: "canvas-view",
    label: "Interactive Canvas",
    iconName: "box",
    desc: "Diagram or canvas workspace using xyflow / tldraw (No-SSR).",
    renderMode: "client",
    loadStrategy: "dynamic-no-ssr",
    libraries: ["@xyflow/react", "lucide-react"],
    defaultActions: [
      { name: "onSelectElement", event: "click" },
      { name: "onSaveCanvas", event: "click" },
    ],
    defaultDesc: "Full-screen interactive visual canvas workspace for node graph manipulation.",
    defaultUiPrompt: "Infinite grid canvas with custom node templates, floating toolbar, and mini-map overlay.",
  },
];

/** Helper to collect all endpoints from a node */
export function collectEndpoints(
  node: BackendNode,
  storeEndpoints: (Endpoint & { nodeId: string })[],
): Endpoint[] {
  const results: Endpoint[] = [];
  const persisted = storeEndpoints.filter((ep) => ep.nodeId === node.id);
  results.push(...persisted);

  if (node.data?.endpoints) {
    for (const ep of node.data.endpoints) {
      if (!results.find((r) => r.id === ep.id)) results.push(ep);
    }
  }

  if (node.data?.routeGroups) {
    for (const group of node.data.routeGroups) {
      for (const ep of group.endpoints || []) {
        if (!results.find((r) => r.id === ep.id)) results.push(ep);
      }
    }
  }

  return results;
}
