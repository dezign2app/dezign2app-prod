"use client";

import React, { useMemo, useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "@workspace/backend/_generated/api";
import { Id } from "@workspace/backend/_generated/dataModel";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { useSidebarStore } from "@/lib/stores/sidebarStore";
import { useBackendSync } from "../../_components/hooks/useBackendSync";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { NodePaletteSidebar } from "../../_components/NodePaletteSidebar";
import { Terminal } from "../../_components/terminal";
import { PageEditorHeader } from "./_components/PageEditorHeader";
import { PagePreviewViewport } from "./_components/PagePreviewViewport";
import { PageAiPanel } from "./_components/PageAiPanel";

import { useDevServerStatus } from "./_hooks/useDevServerStatus";
import { usePageCodeSync } from "./_hooks/usePageCodeSync";
import { usePageConversations } from "./_hooks/usePageConversations";
import { usePageAiEditor } from "./_hooks/usePageAiEditor";

import {
  pageRouteToFolderPath,
  pageRouteToUrl,
  parsePageRoute,
} from "@workspace/canvas";

export default function PageEditorPage({
  params,
}: {
  params: Promise<{ projectId: string; nodeId: string }>;
}) {
  const { projectId, nodeId } = React.use(params);

  // Sync canvas store with Convex
  useBackendSync(projectId, "graph");

  // Fetch project basic info
  const project = useQuery(api.projects.getProjectById, {
    projectId: projectId as Id<"projects">,
  });
  const projectName = project?.name || "Blueprint";

  // Canvas store selectors
  const node = useBackendCanvasStore((s) => s.nodes.find((n) => n.id === nodeId));
  const nodes = useBackendCanvasStore((s) => s.nodes);
  const edges = useBackendCanvasStore((s) => s.edges);

  // Layout sidebar stores
  const paletteOpen = useSidebarStore((s) => s.paletteOpen);
  const setPaletteOpen = useSidebarStore((s) => s.setPaletteOpen);
  const aiPanelOpen = useSidebarStore((s) => s.aiPanelOpen);
  const setAiPanelOpen = useSidebarStore((s) => s.setAiPanelOpen);
  const terminalOpen = useSidebarStore((s) => s.terminalOpen);
  const setTerminalOpen = useSidebarStore((s) => s.setTerminalOpen);

  // Find connected WebApp node to get port
  const connectedWebAppNode = useMemo(() => {
    const edge = edges.find(
      (e) =>
        (e.target === nodeId || e.source === nodeId) &&
        nodes.some((n) => n.type === "webApp" && (n.id === e.source || n.id === e.target))
    );
    if (!edge) return null;
    return nodes.find(
      (n) => n.type === "webApp" && (n.id === edge.source || n.id === edge.target)
    ) ?? null;
  }, [nodes, edges, nodeId]);

  const port = connectedWebAppNode?.data?.port || "3000";
  const rawLabel = typeof node?.data?.label === "string" ? node.data.label : "";
  const pageRoute = pageRouteToUrl(rawLabel);
  const pageFolderSlug = pageRouteToFolderPath(rawLabel);
  const pageName = parsePageRoute(rawLabel) || nodeId;
  const currentCode = typeof node?.data?.pageSourceCode === "string" ? node.data.pageSourceCode : undefined;
  const previewUrl = `http://localhost:${port}${pageRoute}`;

  // Workspace output directory from localStorage
  const outputDir =
    typeof window !== "undefined"
      ? localStorage.getItem(`workspace_dir_${projectId}`) ||
        localStorage.getItem(`docker_dir_${projectId}`) ||
        localStorage.getItem("blueprint_workspace_dir") ||
        ""
      : "";

  // Convex URL for backend engine
  const convexUrl =
    typeof window !== "undefined"
      ? (window as Window & { __convexUrl?: string }).__convexUrl ||
        process.env.NEXT_PUBLIC_CONVEX_URL ||
        ""
      : "";

  // 1. Hook: Dev Server status & preview reloading
  const {
    isServerRunning,
    isCheckingServer,
    iframeKey,
    reloadPreview,
    checkServerStatus,
  } = useDevServerStatus({ port });

  // 2. Hook: Page code disk/convex resolution & write
  const {
    resolveCurrentPageCode,
    writeCodeToDisk,
  } = usePageCodeSync({
    connectedWebAppNode,
    pageFolderSlug,
    outputDir,
    node,
  });

  // 3. Hook: Conversation thread history & messages
  const {
    activeConversationId,
    setActiveConversationId,
    convexMessages,
    messages,
    setTransientMessages,
    handleSelectConversation,
    handleNewConversation,
    handleDeleteConversation,
    handleClearHistory,
    updateTitleOnFirstMessage,
  } = usePageConversations({
    projectId,
    nodeId,
    pageName,
  });

  // 4. Hook: AI generation stream, stopping, reset & unlock
  const {
    prompt,
    setPrompt,
    streaming,
    streamingContent,
    streamingStatus,
    isAiEditing,
    handleSend,
    handleStop,
    handleUnlock,
    handleReset,
  } = usePageAiEditor({
    projectId,
    nodeId,
    pageName,
    pageRoute,
    node,
    convexUrl,
    activeConversationId,
    setActiveConversationId,
    convexMessages,
    setTransientMessages,
    updateTitleOnFirstMessage,
    resolveCurrentPageCode,
    writeCodeToDisk,
    onCodeUpdated: reloadPreview,
  });

  const handleStartDevServer = useCallback(() => {
    setTerminalOpen(true);
    toast.info("Terminal opened — start dev server with 'pnpm dev'");
  }, [setTerminalOpen]);

  if (project === undefined) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (project === null) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Project not found.</p>
      </div>
    );
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-background text-foreground select-none flex flex-col font-sans">
      {/* Top Header */}
      <PageEditorHeader
        projectId={projectId}
        projectName={projectName}
        pageName={pageName}
        pageRoute={pageRoute}
        previewUrl={previewUrl}
        hasCustomCode={Boolean(currentCode)}
        paletteOpen={paletteOpen}
        aiPanelOpen={aiPanelOpen}
        onTogglePalette={() => setPaletteOpen(!paletteOpen)}
        onToggleAiPanel={() => setAiPanelOpen(!aiPanelOpen)}
        onReloadPreview={reloadPreview}
        onReset={currentCode ? handleReset : undefined}
      />

      {/* Main Workspace: Left Palette + Center (Preview + Terminal) + Right AI Panel */}
      <div className="flex-1 min-h-0 w-full flex overflow-hidden relative">
        {/* Left: Node Palette Sidebar */}
        <NodePaletteSidebar
          view="graph"
          isOpen={paletteOpen}
          onToggle={() => setPaletteOpen(!paletteOpen)}
        />

        {/* Center: Live Preview Viewport + Docked Terminal at bottom */}
        <div className="flex-1 min-w-0 h-full flex flex-col pointer-events-none overflow-hidden relative">
          <PagePreviewViewport
            projectId={projectId}
            port={port}
            pageRoute={pageRoute}
            pageName={pageName}
            previewUrl={previewUrl}
            iframeKey={iframeKey}
            isServerRunning={isServerRunning}
            isCheckingServer={isCheckingServer}
            onRetryServerCheck={() => {
              checkServerStatus();
              reloadPreview();
            }}
            onStartDevServer={handleStartDevServer}
            onReloadPreview={reloadPreview}
          />

          {/* Bottom Docked Terminal */}
          <Terminal
            projectId={projectId}
            projectName={projectName}
            isOpen={terminalOpen}
            onToggleOpen={() => setTerminalOpen((prev) => !prev)}
          />
        </div>

        {/* Right: AI Assistant Sidebar */}
        <PageAiPanel
          isOpen={aiPanelOpen}
          onToggle={() => setAiPanelOpen(!aiPanelOpen)}
          messages={messages}
          prompt={prompt}
          setPrompt={setPrompt}
          streaming={streaming}
          streamingContent={streamingContent}
          streamingStatus={streamingStatus}
          isAiEditing={isAiEditing}
          outputDir={outputDir}
          pageName={pageName}
          onSend={handleSend}
          onStop={handleStop}
          onReset={currentCode ? handleReset : undefined}
          onUnlock={handleUnlock}
          onClearHistory={activeConversationId ? handleClearHistory : undefined}
          hasCustomCode={Boolean(currentCode)}
          projectId={projectId}
          nodeId={nodeId}
          activeConversationId={activeConversationId}
          onSelectConversation={handleSelectConversation}
          onNewConversation={handleNewConversation}
          onDeleteConversation={handleDeleteConversation}
        />
      </div>
    </div>
  );
}
