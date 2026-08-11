import { WebAppZone } from "@workspace/canvas";

export const DEFAULT_REDIRECTS = {
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
    rule: {
      id: "rule-private",
      scope: "zone",
      conditions: { kind: "leaf", condition: { type: "auth", op: "signedIn" } },
      redirects: { ...DEFAULT_REDIRECTS },
    },
  },
];

export const PRESET_TRIGGER_OPTIONS: { value: string; label: string; defaultRoute: string }[] = [
  { value: "no-auth", label: "Unauthenticated (no-auth)", defaultRoute: "/login" },
  { value: "no-org", label: "No Organization (no-org)", defaultRoute: "/select-org" },
  { value: "wrong-role", label: "Insufficient Role (wrong-role)", defaultRoute: "/unauthorized" },
  { value: "no-access", label: "No Paid Access (no-access)", defaultRoute: "/pricing" },
  { value: "wrong-plan", label: "Plan Upgrade Needed (wrong-plan)", defaultRoute: "/pricing" },
  { value: "custom-denied", label: "Custom Logic Denied (custom-denied)", defaultRoute: "/login" },
  { value: "default", label: "Default Fallback Redirect", defaultRoute: "/login" },
];
