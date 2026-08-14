import React, { useState, useEffect } from "react";
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
import { ShieldCheck, Globe, ArrowRightLeft, Plus, Trash2, KeyRound } from "lucide-react";
import { RedirectsConfig } from "@workspace/canvas";
import { BackendNode } from "@/types/canvas";
import { labelToSlug } from "@/lib/compiler/webClients/nextjs/v16/slugUtils";
import { AuthConfigSectionProps } from "./types";

interface ConfiguredPage {
  id: string;
  path: string;
  label: string;
  isCanvasPage?: boolean;
}

const getConfiguredPages = (allNodes: BackendNode[]): ConfiguredPage[] => {
  const pagesList: ConfiguredPage[] = [];
  const seenPaths = new Set<string>();

  // 1. WebClient nodes from Canvas
  const webClientNodes = (allNodes || []).filter(
    (n) => n.type === "webClient" || n.data?.isWebClient,
  );

  webClientNodes.forEach((node, idx) => {
    const rawLabel = node.data?.label || `Page ${idx + 1}`;
    const cleanLabel = rawLabel.trim().toLowerCase();
    let path: string | undefined = node.data?.path || node.data?.pageSlug || node.data?.route;
    if (!path || cleanLabel === "/" || cleanLabel === "home" || cleanLabel === "landing" || cleanLabel === "root") {
      const slug = labelToSlug(rawLabel, idx);
      path = slug === "home" ? "/" : `/${slug}`;
    }
    if (!path.startsWith("/")) path = `/${path}`;
    if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);

    pagesList.push({
      id: node.id,
      path,
      label: rawLabel,
      isCanvasPage: true,
    });
    seenPaths.add(path);
  });

  // 2. WebApp node routes
  const webAppNode = (allNodes || []).find((n) => n.type === "webApp");
  if (webAppNode?.data?.routes && Array.isArray(webAppNode.data.routes)) {
    webAppNode.data.routes.forEach((r, idx) => {
      if (r.path) {
        const p = r.path.startsWith("/") ? r.path : `/${r.path}`;
        const id = r.id || `webapp-route-${idx}`;
        if (!seenPaths.has(p)) {
          pagesList.push({
            id,
            path: p,
            label: r.name || p,
            isCanvasPage: true,
          });
          seenPaths.add(p);
        }
      }
    });
  }

  return pagesList;
};

interface RedirectRouteSelectorProps {
  label: string;
  value: string;
  nodeIdValue?: string;
  placeholder: string;
  configuredPages: ConfiguredPage[];
  onChange: (newPath: string, newNodeId?: string) => void;
}

const RedirectRouteSelector: React.FC<RedirectRouteSelectorProps> = ({
  label,
  value,
  nodeIdValue,
  placeholder,
  configuredPages,
  onChange,
}) => {
  // Find page by nodeId first, then fall back to path matching
  const matchingByNodeId = nodeIdValue
    ? configuredPages.find((p) => p.id === nodeIdValue)
    : undefined;
  const matchingByPath = configuredPages.find((p) => p.path === value);
  const matchedPage = matchingByNodeId || matchingByPath;

  const effectivePath = matchedPage ? matchedPage.path : value;
  const currentSelectValue = matchedPage ? matchedPage.id : "";

  return (
    <div className="flex flex-col gap-1">
      <Label className="text-[11px] text-muted-foreground font-medium">{label}</Label>

      <Select
        value={currentSelectValue}
        onValueChange={(selectedId) => {
          const selectedPage = configuredPages.find((p) => p.id === selectedId);
          if (selectedPage) {
            onChange(selectedPage.path, selectedPage.id);
          }
        }}
      >
        <SelectTrigger className="h-7 text-xs font-mono bg-background w-full">
          <SelectValue placeholder={placeholder}>
            {matchedPage ? (
              <div className="flex items-center gap-1.5 overflow-hidden">
                <span className="font-sans font-medium text-foreground truncate">
                  {matchedPage.label}
                </span>
              </div>
            ) : (
              effectivePath || placeholder
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="nodrag">
          {configuredPages.length > 0 ? (
            <SelectGroup>
              <SelectLabel className="text-[10px] uppercase font-bold tracking-wider">
                Configured Canvas Pages
              </SelectLabel>
              {configuredPages.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-xs font-mono">
                  <div className="flex items-center justify-between w-full gap-2">
                    <span className="font-sans font-medium text-foreground">{p.label}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">({p.path})</span>
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          ) : (
            <div className="p-2 text-xs text-muted-foreground italic text-center">
              No canvas pages found
            </div>
          )}
        </SelectContent>
      </Select>
    </div>
  );
};

export const AuthSecuritySection: React.FC<AuthConfigSectionProps> = ({
  data,
  updateData,
  allNodes,
}) => {
  const redirects: RedirectsConfig = data.redirects || {};

  const trustedOrigins: string[] = data.trustedOrigins || [
    "http://localhost:3000",
    "http://localhost:5173",
  ];

  const configuredPages = getConfiguredPages(allNodes);
  const canvasPagesCount = configuredPages.filter((p) => p.isCanvasPage).length;

  // Auto-sync saved path values when linked canvas node paths change (e.g. node label edited)
  useEffect(() => {
    let needsUpdate = false;
    const updatedRedirects = { ...redirects };

    if (redirects.signInPageNodeId) {
      const page = configuredPages.find((p) => p.id === redirects.signInPageNodeId);
      if (page && page.path !== redirects.signInPageUrl) {
        updatedRedirects.signInPageUrl = page.path;
        needsUpdate = true;
      }
    }
    if (redirects.signUpPageNodeId) {
      const page = configuredPages.find((p) => p.id === redirects.signUpPageNodeId);
      if (page && page.path !== redirects.signUpPageUrl) {
        updatedRedirects.signUpPageUrl = page.path;
        needsUpdate = true;
      }
    }
    if (redirects.signInRedirectNodeId) {
      const page = configuredPages.find((p) => p.id === redirects.signInRedirectNodeId);
      if (page && page.path !== redirects.signInRedirectUrl) {
        updatedRedirects.signInRedirectUrl = page.path;
        needsUpdate = true;
      }
    }
    if (redirects.signUpRedirectNodeId) {
      const page = configuredPages.find((p) => p.id === redirects.signUpRedirectNodeId);
      if (page && page.path !== redirects.signUpRedirectUrl) {
        updatedRedirects.signUpRedirectUrl = page.path;
        needsUpdate = true;
      }
    }
    if (redirects.signOutRedirectNodeId) {
      const page = configuredPages.find((p) => p.id === redirects.signOutRedirectNodeId);
      if (page && page.path !== redirects.signOutRedirectUrl) {
        updatedRedirects.signOutRedirectUrl = page.path;
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      updateData({ redirects: updatedRedirects });
    }
  }, [allNodes]);

  return (
    <AccordionItem
      value="security-redirects"
      className="rounded-xl border bg-card/50 shadow-sm backdrop-blur-sm overflow-hidden"
    >
      <AccordionTrigger className="px-4 py-3.5 hover:no-underline hover:bg-muted/30 transition-colors">
        <div className="flex items-center gap-2 text-left flex-1">
          <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Auth Pages, Redirects & CORS
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
          {/* Bearer Token & Client Authorization Header Card */}
          <div className="flex flex-col gap-2.5 p-3.5 bg-amber-500/8 rounded-lg border border-amber-500/25 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-300">
                <ShieldCheck className="w-4 h-4 text-amber-500" />
                <span>Protected Routes & Authorization Header</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 font-medium">
                Bearer Token
              </span>
            </div>
            <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 leading-relaxed">
              When client pages or actions invoke protected backend endpoints, the{" "}
              <code className="rounded bg-amber-500/20 px-1 py-0.5 font-mono text-[10px] text-amber-900 dark:text-amber-200 font-semibold">
                Authorization: Bearer &lt;token&gt;
              </code>{" "}
              header is automatically added and forwarded on authenticated client calls.
            </p>
          </div>

          {/* Auth Pages Definition Card */}
          <div className="flex flex-col gap-3 p-3.5 bg-background/50 rounded-lg border border-border/40 text-xs">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-primary" /> Auth Pages (Login & Register)
              </Label>
              <span className="text-[10px] text-muted-foreground font-mono">
                Define Auth UI routes
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <RedirectRouteSelector
                label="Sign-In / Login Page Path"
                placeholder="/login"
                value={redirects.signInPageUrl || ""}
                nodeIdValue={redirects.signInPageNodeId}
                configuredPages={configuredPages}
                onChange={(val, nodeId) =>
                  updateData({
                    redirects: { ...redirects, signInPageUrl: val, signInPageNodeId: nodeId },
                  })
                }
              />

              <RedirectRouteSelector
                label="Sign-Up / Register Page Path"
                placeholder="/register"
                value={redirects.signUpPageUrl || ""}
                nodeIdValue={redirects.signUpPageNodeId}
                configuredPages={configuredPages}
                onChange={(val, nodeId) =>
                  updateData({
                    redirects: { ...redirects, signUpPageUrl: val, signUpPageNodeId: nodeId },
                  })
                }
              />
            </div>
          </div>

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
                nodeIdValue={redirects.signInRedirectNodeId}
                configuredPages={configuredPages}
                onChange={(val, nodeId) =>
                  updateData({
                    redirects: { ...redirects, signInRedirectUrl: val, signInRedirectNodeId: nodeId },
                  })
                }
              />

              <RedirectRouteSelector
                label="Sign-Up Success Redirect"
                placeholder="/onboarding"
                value={redirects.signUpRedirectUrl || ""}
                nodeIdValue={redirects.signUpRedirectNodeId}
                configuredPages={configuredPages}
                onChange={(val, nodeId) =>
                  updateData({
                    redirects: { ...redirects, signUpRedirectUrl: val, signUpRedirectNodeId: nodeId },
                  })
                }
              />

              <RedirectRouteSelector
                label="Sign-Out Redirect"
                placeholder="/login"
                value={redirects.signOutRedirectUrl || ""}
                nodeIdValue={redirects.signOutRedirectNodeId}
                configuredPages={configuredPages}
                onChange={(val, nodeId) =>
                  updateData({
                    redirects: { ...redirects, signOutRedirectUrl: val, signOutRedirectNodeId: nodeId },
                  })
                }
              />

              <div className="flex flex-col gap-1">
                <Label className="text-[11px] text-muted-foreground font-medium">OAuth Callback Base Route</Label>
                <Input
                  className="h-7 text-xs font-mono bg-background"
                  placeholder="/api/auth/callback"
                  value={redirects.callbackUrl || "/api/auth/callback"}
                  onChange={(e) =>
                    updateData({
                      redirects: { ...redirects, callbackUrl: e.target.value },
                    })
                  }
                />
                <span className="text-[10px] text-muted-foreground leading-tight px-0.5">
                  Backend API route prefix. Better Auth automatically appends <code className="font-mono text-[9px] text-primary">/[provider]</code>.
                </span>
              </div>
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


