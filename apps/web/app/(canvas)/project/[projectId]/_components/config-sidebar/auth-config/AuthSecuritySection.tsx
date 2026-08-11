import React, { useState } from "react";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Button } from "@workspace/ui/components/button";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { ShieldCheck, Globe, ArrowRightLeft, Plus, Trash2, Edit3, LayoutList } from "lucide-react";
import { RedirectsConfig } from "@workspace/canvas";
import { BackendNode } from "@/types/canvas";
import { labelToSlug } from "@/lib/compiler/webClients/nextjs/v16/slugUtils";
import { AuthConfigSectionProps } from "./types";

interface ConfiguredPage {
  path: string;
  label: string;
  isCanvasPage?: boolean;
}

const getConfiguredPages = (allNodes: BackendNode[]): ConfiguredPage[] => {
  const pagesMap = new Map<string, ConfiguredPage>();

  // 1. WebClient nodes from Canvas
  const webClientNodes = (allNodes || []).filter(
    (n) => n.type === "webClient" || n.data?.isWebClient,
  );

  webClientNodes.forEach((node, idx) => {
    const rawLabel = node.data?.label || `Page ${idx + 1}`;
    let path: string | undefined = node.data?.path || node.data?.pageSlug || node.data?.route;
    if (!path) {
      const slug = labelToSlug(rawLabel, idx);
      path = slug === "home" ? "/" : `/${slug}`;
    }
    if (!path.startsWith("/")) path = `/${path}`;

    pagesMap.set(path, {
      path,
      label: rawLabel,
      isCanvasPage: true,
    });
  });

  // 2. WebApp node routes
  const webAppNode = (allNodes || []).find((n) => n.type === "webApp");
  if (webAppNode?.data?.routes && Array.isArray(webAppNode.data.routes)) {
    webAppNode.data.routes.forEach((r) => {
      if (r.path) {
        const p = r.path.startsWith("/") ? r.path : `/${r.path}`;
        if (!pagesMap.has(p)) {
          pagesMap.set(p, {
            path: p,
            label: r.name || p,
            isCanvasPage: true,
          });
        }
      }
    });
  }

  // 3. Default standard auth routes
  const defaultRoutes = [
    { path: "/dashboard", label: "Dashboard" },
    { path: "/onboarding", label: "Onboarding" },
    { path: "/login", label: "Login / Sign-In" },
    { path: "/api/auth/callback", label: "OAuth Callback" },
    { path: "/", label: "Home" },
  ];

  defaultRoutes.forEach((def) => {
    if (!pagesMap.has(def.path)) {
      pagesMap.set(def.path, {
        path: def.path,
        label: def.label,
        isCanvasPage: false,
      });
    }
  });

  return Array.from(pagesMap.values());
};

interface RedirectRouteSelectorProps {
  label: string;
  value: string;
  placeholder: string;
  configuredPages: ConfiguredPage[];
  onChange: (newValue: string) => void;
}

const RedirectRouteSelector: React.FC<RedirectRouteSelectorProps> = ({
  label,
  value,
  placeholder,
  configuredPages,
  onChange,
}) => {
  const [isCustomMode, setIsCustomMode] = useState(false);

  const matchesKnown = configuredPages.some((p) => p.path === value);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] text-muted-foreground font-medium">{label}</Label>
        <button
          type="button"
          onClick={() => setIsCustomMode(!isCustomMode)}
          className="text-[10px] text-primary hover:underline flex items-center gap-1 font-medium cursor-pointer"
        >
          {isCustomMode ? (
            <>
              <LayoutList className="w-3 h-3" /> Select page
            </>
          ) : (
            <>
              <Edit3 className="w-3 h-3" /> Custom path
            </>
          )}
        </button>
      </div>

      {isCustomMode ? (
        <Input
          className="h-7 text-xs font-mono bg-background"
          placeholder={placeholder}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Select
          value={matchesKnown ? value : value ? "__custom_val__" : ""}
          onValueChange={(val) => {
            if (val === "__enter_custom__") {
              setIsCustomMode(true);
            } else if (val !== "__custom_val__") {
              onChange(val);
            }
          }}
        >
          <SelectTrigger className="h-7 text-xs font-mono bg-background w-full">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent className="nodrag">
            {configuredPages.some((p) => p.isCanvasPage) && (
              <SelectGroup>
                <SelectLabel className="text-[10px] uppercase font-bold tracking-wider">
                  Configured Canvas Pages
                </SelectLabel>
                {configuredPages
                  .filter((p) => p.isCanvasPage)
                  .map((p) => (
                    <SelectItem key={p.path} value={p.path} className="text-xs font-mono">
                      <div className="flex items-center justify-between w-full gap-2">
                        <span className="font-sans font-medium text-foreground">{p.label}</span>
                      </div>
                    </SelectItem>
                  ))}
              </SelectGroup>
            )}
          </SelectContent>
        </Select>
      )}
    </div>
  );
};

export const AuthSecuritySection: React.FC<AuthConfigSectionProps> = ({
  data,
  updateData,
  allNodes,
}) => {
  const redirects: RedirectsConfig = data.redirects || {
    signInRedirectUrl: "/dashboard",
    signUpRedirectUrl: "/onboarding",
    signOutRedirectUrl: "/login",
    callbackUrl: "/api/auth/callback",
  };

  const trustedOrigins: string[] = data.trustedOrigins || [
    "http://localhost:3000",
    "http://localhost:5173",
  ];

  const configuredPages = getConfiguredPages(allNodes);
  const canvasPagesCount = configuredPages.filter((p) => p.isCanvasPage).length;

  return (
    <AccordionItem
      value="security-redirects"
      className="rounded-xl border bg-card/50 shadow-sm backdrop-blur-sm overflow-hidden"
    >
      <AccordionTrigger className="px-4 py-3.5 hover:no-underline hover:bg-muted/30 transition-colors">
        <div className="flex items-center gap-2 text-left flex-1">
          <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Trusted Origins & Redirects
          </span>
          <div className="flex items-center gap-1.5 ml-auto mr-2">
            {canvasPagesCount > 0 && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/20 font-medium">
                {canvasPagesCount} {canvasPagesCount === 1 ? "Page" : "Pages"}
              </span>
            )}
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20 font-medium">
              {trustedOrigins.length} Origins
            </span>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4 pt-1">
        <div className="flex flex-col gap-4 pt-2">
          {/* Redirect URLs Card */}
          <div className="flex flex-col gap-3 p-3.5 bg-background/50 rounded-lg border border-border/40 text-xs">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <ArrowRightLeft className="w-3.5 h-3.5 text-primary" /> Redirect & Callback Routing
              </Label>
              {canvasPagesCount > 0 && (
                <span className="text-[10px] text-muted-foreground font-mono">
                  {canvasPagesCount} canvas page{canvasPagesCount === 1 ? "" : "s"} detected
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <RedirectRouteSelector
                label="Sign-In Success Redirect"
                placeholder="/dashboard"
                value={redirects.signInRedirectUrl || ""}
                configuredPages={configuredPages}
                onChange={(val) =>
                  updateData({
                    redirects: { ...redirects, signInRedirectUrl: val },
                  })
                }
              />

              <RedirectRouteSelector
                label="Sign-Up Success Redirect"
                placeholder="/onboarding"
                value={redirects.signUpRedirectUrl || ""}
                configuredPages={configuredPages}
                onChange={(val) =>
                  updateData({
                    redirects: { ...redirects, signUpRedirectUrl: val },
                  })
                }
              />

              <RedirectRouteSelector
                label="Sign-Out Redirect"
                placeholder="/login"
                value={redirects.signOutRedirectUrl || ""}
                configuredPages={configuredPages}
                onChange={(val) =>
                  updateData({
                    redirects: { ...redirects, signOutRedirectUrl: val },
                  })
                }
              />

              <RedirectRouteSelector
                label="OAuth Callback URL"
                placeholder="/api/auth/callback"
                value={redirects.callbackUrl || ""}
                configuredPages={configuredPages}
                onChange={(val) =>
                  updateData({
                    redirects: { ...redirects, callbackUrl: val },
                  })
                }
              />
            </div>
          </div>

          {/* Trusted Origins / CORS List Card */}
          <div className="flex flex-col gap-3 p-3.5 bg-background/50 rounded-lg border border-border/40 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-primary" /> Trusted Origins & CORS List
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Allowed web client origins for auth cookies and CORS credentials.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs bg-background shrink-0 cursor-pointer"
                onClick={() => {
                  const updated = [...trustedOrigins, `https://app${trustedOrigins.length + 1}.example.com`].filter(Boolean);
                  updateData({ trustedOrigins: updated });
                }}
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Origin
              </Button>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              {trustedOrigins.map((origin, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2 rounded bg-background border border-border/50 text-xs"
                >
                  <Input
                    className="h-7 text-xs font-mono bg-background flex-1"
                    placeholder="https://yourdomain.com"
                    value={origin}
                    onChange={(e) => {
                      const updated = trustedOrigins.map((o, i) => (i === idx ? e.target.value : o));
                      updateData({ trustedOrigins: updated });
                    }}
                  />
                  <button
                    onClick={() => {
                      const updated = trustedOrigins.filter((_, i) => i !== idx);
                      updateData({ trustedOrigins: updated });
                    }}
                    className="p-1 text-muted-foreground hover:text-destructive shrink-0 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};

