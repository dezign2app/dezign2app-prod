"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@workspace/backend/_generated/api";
import { Id } from "@workspace/backend/_generated/dataModel";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { Endpoint, pageRouteToUrl, parsePageRoute } from "@workspace/canvas";
import { Parameter, Schema, PageSection } from "@/types/canvas";
import { RequestBodyMode } from "./RequestBodyEditor";
import { useTerminalWorkspace } from "../terminal/hooks/useTerminalWorkspace";
import { useWebPageCodeMismatch } from "./useWebPageCodeMismatch";
import { PageCodeMismatchDialog } from "./PageCodeMismatchDialog";
import { isElectron, getElectronAPI } from "@/lib/electron";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import {
  Layers,
  Sparkles,
  Shield,
  FileCode,
  Sliders,
  Globe,
} from "lucide-react";

import {
  WebPageHeaderSection,
  WebPageParametersSection,
  WebPageMembershipSection,
  WebPageCodeSyncSection,
  WebPageAiPromptsSection,
  WebPageSectionsOverviewSection,
  WebPageProtectionSection,
} from "./web-page-config";

export const WebPageConfig = ({
  id,
  nodeId,
}: {
  id: string;
  nodeId: string;
}) => {
  const router = useRouter();
  const node = useBackendCanvasStore((s) =>
    s.nodes.find((n) => n.id === nodeId),
  );
  const allNodes = useBackendCanvasStore((s) => s.nodes);
  const allEdges = useBackendCanvasStore((s) => s.edges);
  const updateNode = useBackendCanvasStore((s) => s.updateNode);
  const patchNodeData = useMutation(api.canvas.patchNodeData);

  const [activeTab, setActiveTab] = useState("sections");

  const projectId = typeof window !== "undefined"
    ? window.location.pathname.split("/project/")[1]?.split("/")[0] ?? ""
    : "";

  const { outputDir } = useTerminalWorkspace(projectId);

  if (!node) return null;

  const data = node.data;

  const updateData = (changes: Partial<typeof data>) => {
    updateNode(nodeId, { data: { ...data, ...changes } });
  };

  const appName = data.appName || "Web App";
  const appSlug =
    data.appSlug ||
    appName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const useZoneDefault = data.useZoneDefault !== false;
  const accessType = data.accessType || "public";
  const allowedRoles = data.allowedRoles || [];
  const requiredPlans = data.requiredPlans || [];
  const redirectTo =
    data.redirectTo ||
    (accessType === "payment-gated"
      ? "/pricing"
      : accessType === "org-gated"
      ? "/select-org"
      : "/login");

  // Determine connected WebApp section name
  const incomingEdge = allEdges.find(
    (e) => e.target === nodeId || e.source === nodeId,
  );
  const connectedWebApp = incomingEdge
    ? allNodes.find(
        (n) =>
          n.type === "webApp" &&
          (n.id === incomingEdge.source || n.id === incomingEdge.target),
      )
    : null;

  let connectedZoneName: string | null = null;
  if (connectedWebApp && incomingEdge) {
    const handleId =
      incomingEdge.source === connectedWebApp.id
        ? incomingEdge.sourceHandle
        : incomingEdge.targetHandle;
    const zones = connectedWebApp.data?.zones || [];
    const matchedZone = zones.find((z) => z.handleId === handleId);
    if (matchedZone) {
      connectedZoneName = matchedZone.name;
    }
  }

  const isProtected =
    data.useZoneDefault === false
      ? data.accessType !== "public"
      : Boolean(
          connectedZoneName?.toLowerCase().includes("private") ||
            connectedZoneName?.toLowerCase().includes("protected") ||
            incomingEdge?.sourceHandle === "private-in" ||
            incomingEdge?.targetHandle === "private-in" ||
            (data.accessType && data.accessType !== "public"),
        );

  // Find connected service endpoint via any edge connected to this WebPage node
  const allEndpoints = useBackendCanvasStore((s) => s.endpoints);
  const connectedServiceEdge = allEdges.find(
    (e) =>
      (e.source === nodeId &&
        allNodes.some((n) => n.id === e.target && n.type === "service")) ||
      (e.target === nodeId &&
        allNodes.some((n) => n.id === e.source && n.type === "service")),
  );

  let connectedEndpoint: Endpoint | null = null;
  if (connectedServiceEdge) {
    const isSource = connectedServiceEdge.source === nodeId;
    const targetNodeId = isSource
      ? connectedServiceEdge.target
      : connectedServiceEdge.source;
    const targetHandle = isSource
      ? connectedServiceEdge.targetHandle
      : connectedServiceEdge.sourceHandle;
    const targetNode = allNodes.find((n) => n.id === targetNodeId);

    if (targetNode) {
      let endpointId = targetHandle
        ? targetHandle.replace(
            /^(endpoint-in-|endpoint-out-|endpoints-in-|endpoints-out-|events-in-|events-out-)/,
            "",
          )
        : undefined;

      if (endpointId && endpointId.includes("-in-")) {
        const parts = endpointId.split("-in-");
        endpointId = parts[parts.length - 1];
      }

      if (endpointId) {
        connectedEndpoint =
          allEndpoints.find(
            (ep) =>
              ep.nodeId === targetNode.id &&
              (ep.id === endpointId || ep.name === endpointId),
          ) ||
          (targetNode.data?.endpoints as Endpoint[] | undefined)?.find(
            (ep) => ep.id === endpointId || ep.name === endpointId,
          ) ||
          null;
      }

      if (!connectedEndpoint) {
        const srvEndpoints = allEndpoints.filter(
          (ep) => ep.nodeId === targetNode.id,
        );
        if (srvEndpoints.length > 0 && srvEndpoints[0]) {
          connectedEndpoint = srvEndpoints[0];
        } else if (
          targetNode.data?.endpoints &&
          (targetNode.data.endpoints as Endpoint[]).length > 0
        ) {
          connectedEndpoint = (targetNode.data.endpoints as Endpoint[])[0] || null;
        }
      }
    }
  }

  // Hook to monitor real-time mismatch between local disk files and Convex server file / compiler baseline
  const {
    status: mismatchStatus,
    serverCode,
    detectedDiskPath,
    defaultFilePath,
    diffSummary,
    localDiskCode,
    hasCustomServerFile,
    isSaving: isMismatchSaving,
    dialogOpen: mismatchDialogOpen,
    setDialogOpen: setMismatchDialogOpen,
    pageName,
    pageRoute,
    checkDiskStatus,
    mergeAllToServer,
    mergeSelectedToServer,
    overwriteLocalWithServer,
    resetToCompilerBaseline,
  } = useWebPageCodeMismatch({
    projectId,
    nodeId,
    outputDir,
    node,
    connectedWebAppNode: connectedWebApp,
    allNodes,
    allEdges,
    endpoints: allEndpoints,
  });

  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  const handleGenerateAiCode = async () => {
    if (isGeneratingAi) return;
    const promptText = [
      data.description ? `Page Purpose: ${data.description}` : "",
      data.uiPrompt ? `Visual & Theme Style: ${data.uiPrompt}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    if (!promptText.trim()) {
      toast.error("Please provide a page purpose or visual style prompt first.");
      return;
    }

    setIsGeneratingAi(true);
    toast.info("Generating UI code with AI...");

    try {
      const engineBaseUrl =
        process.env.NEXT_PUBLIC_SYSTEM_DESIGN_ENGINE_URL || "http://localhost:3002";
      const convexUrl =
        typeof window !== "undefined"
          ? (window as Window & { __convexUrl?: string }).__convexUrl ||
            process.env.NEXT_PUBLIC_CONVEX_URL ||
            ""
          : "";

      let token: string | undefined = undefined;
      try {
        const tokenRes = await fetch("/api/auth/token");
        if (tokenRes.ok) {
          const tokenData = await tokenRes.json();
          token = tokenData.token;
        }
      } catch {}

      const rawLabel = typeof data.label === "string" ? data.label : "";
      const routeUrl = pageRouteToUrl(rawLabel);
      const nameParsed = parsePageRoute(rawLabel) || nodeId;

      const response = await fetch(`${engineBaseUrl}/page-editor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeId,
          projectId,
          currentCode: serverCode || "",
          prompt: promptText,
          pageName: nameParsed,
          pageRoute: routeUrl,
          convexUrl,
          token,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Engine error: ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let finalCode = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.type === "done" && parsed.code) {
              finalCode = parsed.code;
            }
          } catch {}
        }
      }

      if (finalCode) {
        // 1. Direct sync to Convex backend
        updateData({ pageSourceCode: finalCode, aiEditing: false });
        await patchNodeData({
          projectId: projectId as Id<"projects">,
          nodeId,
          patch: { pageSourceCode: finalCode, aiEditing: false },
        });

        // 2. Direct sync to local disk
        if (isElectron() && outputDir) {
          const api = getElectronAPI();
          if (api?.fs?.writeProject) {
            await api.fs.writeProject(
              outputDir,
              [{ filename: detectedDiskPath || defaultFilePath, content: finalCode }],
              { cleanStale: false },
            );
          }
        }

        toast.success("AI code generated & synced to server file and disk!");
        await checkDiskStatus();
      } else {
        toast.error("Generation completed without code output.");
      }
    } catch (err) {
      console.error("[WebPageConfig] AI Generation error:", err);
      toast.error(err instanceof Error ? err.message : "AI Generation failed");
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Resolve live page-level parameters and request body
  const resolvedPageEndpointRequestBody: Schema | undefined = connectedEndpoint?.requestBody
    ? {
        id: connectedEndpoint.requestBody.id || crypto.randomUUID(),
        fields:
          connectedEndpoint.requestBody.fields && connectedEndpoint.requestBody.fields.length > 0
            ? connectedEndpoint.requestBody.fields
            : connectedEndpoint.params && connectedEndpoint.params.length > 0
            ? [...connectedEndpoint.params]
            : [],
        rawJson: connectedEndpoint.requestBody.rawJson || connectedEndpoint.body || "",
      }
    : connectedEndpoint?.body
    ? { id: connectedEndpoint.id || crypto.randomUUID(), rawJson: connectedEndpoint.body, fields: [] }
    : connectedEndpoint?.params && connectedEndpoint.params.length > 0
    ? { id: connectedEndpoint.id || crypto.randomUUID(), fields: [...connectedEndpoint.params] }
    : undefined;

  const hasCustomPageRequestBody = Boolean(
    data.requestBody &&
      ((data.requestBody.fields && data.requestBody.fields.length > 0) ||
        Boolean(data.requestBody.rawJson?.trim())),
  );

  const effectiveRequestBody: Schema = hasCustomPageRequestBody
    ? (data.requestBody as Schema)
    : resolvedPageEndpointRequestBody || data.requestBody || { id: crypto.randomUUID(), fields: [] };

  const isAuthEnabled = data.requireAuth !== false;

  const effectiveHeaders: Parameter[] = useMemo(() => {
    let baseHeaders =
      data.headers && data.headers.length > 0
        ? [...data.headers]
        : connectedEndpoint?.headers
        ? [...connectedEndpoint.headers]
        : [];

    if (isAuthEnabled) {
      if (!baseHeaders.some((h) => h.name.toLowerCase() === "authorization")) {
        baseHeaders = [
          {
            id: "auth-bearer-header",
            name: "Authorization",
            type: "string",
            required: true,
            description: "Bearer <token>",
            defaultValue: "Bearer <token>",
            key: "Authorization",
            value: "Bearer <token>",
          },
          ...baseHeaders,
        ];
      }
    } else {
      baseHeaders = baseHeaders.filter(
        (h) => h.name.toLowerCase() !== "authorization",
      );
    }
    return baseHeaders;
  }, [data.headers, connectedEndpoint?.headers, isAuthEnabled]);

  const effectivePathParams: Parameter[] =
    data.pathParams && data.pathParams.length > 0
      ? data.pathParams
      : connectedEndpoint?.pathParams || [];

  const effectiveQueryParams: Parameter[] =
    data.queryParams && data.queryParams.length > 0
      ? data.queryParams
      : connectedEndpoint?.queryParams || [];

  const effectiveRequestBodyMode: RequestBodyMode =
    data.requestBodyMode ??
    connectedEndpoint?.requestBodyMode ??
    (effectiveRequestBody.rawJson ? "raw_json" : "field_builder");

  const sectionsCount = (data.sections || []).length;

  return (
    <div className="flex flex-col h-full font-sans text-foreground">
      {/* Top Header Section */}
      <WebPageHeaderSection
        label={data.label}
        summary={data.summary}
        description={data.description}
        connectedZoneName={connectedZoneName}
        isProtected={isProtected}
        requireAuth={data.requireAuth !== false}
        onUpdateSummary={(summary) => updateData({ summary, description: summary })}
        onUpdateRequireAuth={(requireAuth) => updateData({ requireAuth })}
      />

      {/* Tabs Navigation */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-1 flex flex-col overflow-hidden mt-4"
      >
        <div className="border-b border-border/50 pb-2 bg-background">
          <TabsList className="grid w-full grid-cols-5 h-8 p-0.5 bg-secondary/50 border border-border/40 rounded-lg">
            <TabsTrigger
              value="sections"
              className="text-[11px] flex items-center justify-center gap-1 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm text-muted-foreground hover:text-foreground transition-all font-medium px-1"
            >
              <Layers size={12} className="shrink-0" />
              <span className="truncate">Sections</span>
              {sectionsCount > 0 && (
                <span className="px-1 py-0.2 rounded-full text-[9px] bg-secondary text-muted-foreground font-mono font-medium">
                  {sectionsCount}
                </span>
              )}
            </TabsTrigger>

            <TabsTrigger
              value="api"
              className="text-[11px] flex items-center justify-center gap-1 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm text-muted-foreground hover:text-foreground transition-all font-medium px-1"
            >
              <Sliders size={12} className="shrink-0" />
              <span className="truncate">API</span>
            </TabsTrigger>

            <TabsTrigger
              value="code"
              className="text-[11px] flex items-center justify-center gap-1 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm text-muted-foreground hover:text-foreground transition-all font-medium px-1"
            >
              <FileCode size={12} className="shrink-0" />
              <span className="truncate">Sync</span>
            </TabsTrigger>

            <TabsTrigger
              value="protection"
              className="text-[11px] flex items-center justify-center gap-1 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm text-muted-foreground hover:text-foreground transition-all font-medium px-1"
            >
              <Shield size={12} className="shrink-0" />
              <span className="truncate">Auth</span>
            </TabsTrigger>

            <TabsTrigger
              value="ai"
              className="text-[11px] flex items-center justify-center gap-1 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm text-muted-foreground hover:text-foreground transition-all font-medium px-1"
            >
              <Sparkles size={12} className="shrink-0" />
              <span className="truncate">AI</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: Sections & Membership */}
        <TabsContent
          value="sections"
          className="flex-1 py-4 space-y-5 overflow-y-auto m-0 outline-none"
        >
          {/* Page Sections & Components */}
          <WebPageSectionsOverviewSection
            nodeId={nodeId}
            sections={data.sections}
            onUpdateSections={(sections) => updateData({ sections })}
            onAddSection={(sectionName) => {
              const currentSections: PageSection[] = data.sections || [];
              const newSec: PageSection = {
                id: `sec-${crypto.randomUUID()}`,
                name: sectionName || `Section${currentSections.length + 1}`,
                renderMode: "server",
                loadStrategy: "eager",
                actions: [],
              };
              updateData({ sections: [...currentSections, newSec] });
            }}
          />

          {/* App & Zone Membership */}
          <WebPageMembershipSection
            label={data.label}
            appSlug={appSlug}
            connectedZoneName={connectedZoneName}
            onUpdateLabel={(label) => updateData({ label })}
            onUpdateAppSlug={(slug) => updateData({ appSlug: slug })}
          />
        </TabsContent>

        {/* Tab 2: API Parameters & Request Body */}
        <TabsContent
          value="api"
          className="flex-1 py-4 space-y-5 overflow-y-auto m-0 outline-none"
        >
          <WebPageParametersSection
            connectedEndpoint={connectedEndpoint}
            effectiveHeaders={effectiveHeaders}
            effectivePathParams={effectivePathParams}
            effectiveQueryParams={effectiveQueryParams}
            effectiveRequestBody={effectiveRequestBody}
            effectiveRequestBodyMode={effectiveRequestBodyMode}
            onUpdateHeaders={(headers) => updateData({ headers })}
            onUpdatePathParams={(pathParams) => updateData({ pathParams })}
            onUpdateQueryParams={(queryParams) => updateData({ queryParams })}
            onUpdateRequestBody={(requestBody) => updateData({ requestBody })}
            onUpdateRequestBodyMode={(requestBodyMode) => updateData({ requestBodyMode })}
          />
        </TabsContent>

        {/* Tab 3: Code Sync & Visual Studio */}
        <TabsContent
          value="code"
          className="flex-1 py-4 space-y-5 overflow-y-auto m-0 outline-none"
        >
          <WebPageCodeSyncSection
            hasCustomServerFile={hasCustomServerFile}
            detectedDiskPath={detectedDiskPath}
            defaultFilePath={defaultFilePath}
            outputDir={outputDir}
            mismatchStatus={mismatchStatus}
            diffSummary={diffSummary}
            isMismatchSaving={isMismatchSaving}
            onOpenMismatchDialog={() => setMismatchDialogOpen(true)}
            onMergeAllToServer={mergeAllToServer}
            onOverwriteLocalWithServer={overwriteLocalWithServer}
            onOpenPageStudio={() => {
              if (projectId) router.push(`/project/${projectId}/pages/${nodeId}`);
            }}
            onResetToCompilerBaseline={resetToCompilerBaseline}
          />
        </TabsContent>

        {/* Tab 4: Protection Rules & Access */}
        <TabsContent
          value="protection"
          className="flex-1 py-4 space-y-5 overflow-y-auto m-0 outline-none"
        >
          <WebPageProtectionSection
            useZoneDefault={useZoneDefault}
            accessType={accessType}
            allowedRoles={allowedRoles}
            requiredPlans={requiredPlans}
            redirectTo={redirectTo}
            isAuthPage={Boolean(data.isAuthPage)}
            onUpdateUseZoneDefault={(useDefault) => updateData({ useZoneDefault: useDefault })}
            onUpdateAccessType={(type, defaultRedirect) => updateData({ accessType: type, redirectTo: defaultRedirect })}
            onUpdateAllowedRoles={(roles) => updateData({ allowedRoles: roles })}
            onUpdateRequiredPlans={(plans) => updateData({ requiredPlans: plans })}
            onUpdateRedirectTo={(target) => updateData({ redirectTo: target })}
            onUpdateIsAuthPage={(isAuth) => updateData({ isAuthPage: isAuth })}
          />
        </TabsContent>

        {/* Tab 5: AI Page Generation Prompts */}
        <TabsContent
          value="ai"
          className="flex-1 py-4 space-y-5 overflow-y-auto m-0 outline-none"
        >
          <WebPageAiPromptsSection
            description={data.description}
            uiPrompt={data.uiPrompt}
            isGeneratingAi={isGeneratingAi}
            onUpdateDescription={(description) => updateData({ description })}
            onUpdateUiPrompt={(uiPrompt) => updateData({ uiPrompt })}
            onGenerateAiCode={handleGenerateAiCode}
          />
        </TabsContent>
      </Tabs>

      {/* Granular Code Mismatch & Merge Dialog */}
      <PageCodeMismatchDialog
        open={mismatchDialogOpen}
        onOpenChange={setMismatchDialogOpen}
        pageName={pageName}
        pageRoute={pageRoute}
        filePath={detectedDiskPath || defaultFilePath}
        serverCode={serverCode}
        localDiskCode={localDiskCode}
        diffSummary={diffSummary}
        isSaving={isMismatchSaving}
        onMergeAll={mergeAllToServer}
        onMergeSelected={mergeSelectedToServer}
        onOverwriteLocal={overwriteLocalWithServer}
      />
    </div>
  );
};
