"use client";

import React, { useState, useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "@workspace/backend/_generated/api";
import { Id } from "@workspace/backend/_generated/dataModel";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { useSidebarStore } from "@/lib/stores/sidebarStore";
import { useBackendSync } from "../../_components/hooks/useBackendSync";
import { isElectron, getElectronAPI } from "@/lib/electron";
import {
  ArrowLeft,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Pencil,
  Trash2,
  PanelLeft,
  Code2,
  Loader2,
  Globe,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";

import { NodePaletteSidebar } from "../../_components/NodePaletteSidebar";
import { Terminal } from "../../_components/terminal";
import { PageAiPanel, Message } from "./_components/PageAiPanel";
import { DevServerOfflineState } from "./_components/DevServerOfflineState";

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

  const node = useBackendCanvasStore((s) => s.nodes.find((n) => n.id === nodeId));
  const updateNode = useBackendCanvasStore((s) => s.updateNode);
  const nodes = useBackendCanvasStore((s) => s.nodes);
  const edges = useBackendCanvasStore((s) => s.edges);

  // Layout UI states (shared and persisted across GraphView and UI Editor)
  const paletteOpen = useSidebarStore((s) => s.paletteOpen);
  const setPaletteOpen = useSidebarStore((s) => s.setPaletteOpen);
  const aiPanelOpen = useSidebarStore((s) => s.aiPanelOpen);
  const setAiPanelOpen = useSidebarStore((s) => s.setAiPanelOpen);
  const terminalOpen = useSidebarStore((s) => s.terminalOpen);
  const setTerminalOpen = useSidebarStore((s) => s.setTerminalOpen);

  // Server status check states
  const [isServerRunning, setIsServerRunning] = useState<boolean | null>(null);
  const [isCheckingServer, setIsCheckingServer] = useState(true);

  // Find the connected WebApp node to get the port
  const connectedWebAppNode = React.useMemo(() => {
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
  const pageRoute = node?.data?.label
    ? node.data.label.startsWith("/") ? node.data.label : `/${node.data.label}`
    : "/";
  const pageName = typeof node?.data?.label === "string" && node.data.label ? node.data.label : nodeId;
  const currentCode = typeof node?.data?.pageSourceCode === "string" ? node.data.pageSourceCode : undefined;
  const isAiEditing = Boolean(node?.data?.aiEditing);

  // Get workspace dir from localStorage
  const outputDir =
    typeof window !== "undefined"
      ? localStorage.getItem(`workspace_dir_${projectId}`) ||
        localStorage.getItem(`docker_dir_${projectId}`) ||
        localStorage.getItem("blueprint_workspace_dir") ||
        ""
      : "";

  // Get Convex URL for engine calls
  const convexUrl =
    typeof window !== "undefined"
      ? (window as Window & { __convexUrl?: string }).__convexUrl ||
        process.env.NEXT_PUBLIC_CONVEX_URL ||
        ""
      : "";

  // iframe key for forcing reloads
  const [iframeKey, setIframeKey] = useState(0);

  // Check if the local dev server is running on the target port
  const checkServerStatus = useCallback(async () => {
    const numericPort = parseInt(String(port), 10);
    if (isNaN(numericPort)) {
      setIsServerRunning(false);
      setIsCheckingServer(false);
      return false;
    }

    setIsCheckingServer(true);

    // 1. In Electron desktop mode: use native port check
    if (isElectron()) {
      const api = getElectronAPI();
      if (api?.network?.isPortOpen) {
        try {
          const open = await api.network.isPortOpen(numericPort);
          setIsServerRunning(open);
          setIsCheckingServer(false);
          return open;
        } catch (e) {}
      }
    }

    // 2. In Browser mode: fast ping
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1200);
      await fetch(`http://localhost:${numericPort}`, {
        method: "GET",
        mode: "no-cors",
        signal: controller.signal,
      });
      clearTimeout(timeout);
      setIsServerRunning(true);
      setIsCheckingServer(false);
      return true;
    } catch (e) {
      setIsServerRunning(false);
      setIsCheckingServer(false);
      return false;
    }
  }, [port]);

  React.useEffect(() => {
    checkServerStatus();
  }, [checkServerStatus, iframeKey]);

  React.useEffect(() => {
    if (isServerRunning === true) return;
    const interval = setInterval(() => {
      checkServerStatus();
    }, 3000);
    return () => clearInterval(interval);
  }, [isServerRunning, checkServerStatus]);

  const handleStartDevServer = () => {
    setTerminalOpen(true);
    toast.info("Terminal opened — start dev server with 'pnpm dev'");
  };

  // AI chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [prompt, setPrompt] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");

  const handleSend = useCallback(async () => {
    if (!prompt.trim() || isAiEditing || streaming) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: prompt.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setPrompt("");
    setStreaming(true);
    setStreamingContent("");

    // Mark node as AI-editing in store (optimistic)
    if (node) {
      updateNode(nodeId, { data: { ...node.data, aiEditing: true } });
    }

    try {
      const engineUrl = "http://localhost:3002/page-editor";
      const response = await fetch(engineUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeId,
          projectId,
          currentCode: currentCode || "",
          prompt: userMsg.content,
          pageName,
          convexUrl,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Engine error: ${response.status}`);
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
            const event = JSON.parse(line);
            if (event.type === "token") {
              setStreamingContent((prev) => prev + event.content);
            } else if (event.type === "done") {
              finalCode = event.code;
            } else if (event.type === "error") {
              throw new Error(event.message);
            }
          } catch (e) {
            // Ignore parse errors for partial lines
          }
        }
      }

      if (finalCode) {
        // Write to local disk via Electron bridge for HMR
        if (isElectron() && outputDir) {
          const electronApi = getElectronAPI();
          if (electronApi?.fs?.writeProject) {
            // Determine the file path relative to outputDir
            const rawSlug = typeof connectedWebAppNode?.data?.appSlug === "string" ? connectedWebAppNode.data.appSlug : "";
            const rawLabel = typeof connectedWebAppNode?.data?.label === "string" ? connectedWebAppNode.data.label : "web-app";
            const webAppSlug = (rawSlug || rawLabel)
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-");
            const pageSlug = pageRoute === "/" ? "" : pageRoute.replace(/^\//, "");
            const filePath = pageSlug
              ? `app/(${webAppSlug})/${pageSlug}/page.tsx`
              : `app/(${webAppSlug})/page.tsx`;

            try {
              await electronApi.fs.writeProject(
                outputDir,
                [{ filename: filePath, content: finalCode }],
                { cleanStale: false }
              );
              toast.success("Page file updated — HMR should reload the preview");
            } catch {
              toast.error("Could not write to disk — set your workspace folder in the terminal");
            }
          }
        }

        // Reload iframe after a short delay to allow HMR
        setTimeout(() => setIframeKey((k) => k + 1), 1200);

        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `✅ Page updated! The AI has rewritten the UI for **${pageName}**. Check the preview.`,
            timestamp: new Date(),
          },
        ]);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "AI request failed";
      toast.error(errorMessage);
      if (node) {
        updateNode(nodeId, { data: { ...node.data, aiEditing: false } });
      }
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `❌ Error: ${errorMessage}. Make sure the system-design-engine is running (\`pnpm dev\` in apps/system-design-engine).`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setStreaming(false);
      setStreamingContent("");
    }
  }, [prompt, isAiEditing, streaming, nodeId, projectId, currentCode, pageName, convexUrl, node, updateNode, outputDir, connectedWebAppNode, pageRoute]);

  const handleReset = () => {
    if (!node) return;
    if (!window.confirm("Reset to compiler-generated page? This will delete the AI-edited version.")) return;
    updateNode(nodeId, {
      data: { ...node.data, pageSourceCode: undefined, aiEditing: false },
    });
    toast.success("Page reset — compiler will regenerate on next build");
  };

  const previewUrl = `http://localhost:${port}${pageRoute}`;

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
      {/* ========================================================================= */}
      {/* TOP HEADER: Breadcrumbs, Controls, Quick Toggles                          */}
      {/* ========================================================================= */}
      <header className="h-12 px-3 border-b border-border/40 bg-sidebar/80 backdrop-blur-md flex items-center justify-between shrink-0 z-30 select-none">
        {/* Left Side: Back button + Left Sidebar Toggle + Page Title / Breadcrumbs */}
        <div className="flex items-center gap-2 min-w-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                asChild
              >
                <Link href={`/project/${projectId}`}>
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Back to Canvas</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={paletteOpen ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={() => setPaletteOpen(!paletteOpen)}
              >
                <PanelLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{paletteOpen ? "Hide Palette" : "Show Palette"}</TooltipContent>
          </Tooltip>

          <div className="h-4 w-[1px] bg-border/60 mx-1 shrink-0" />

          <div className="flex items-center gap-2 truncate text-xs">
            <span className="text-muted-foreground truncate hidden sm:inline">{projectName}</span>
            <span className="text-muted-foreground/60 hidden sm:inline">/</span>
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <Pencil className="w-3.5 h-3.5 text-violet-400 shrink-0" />
              <span className="truncate">{pageName}</span>
            </div>
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 font-mono text-violet-400 border-violet-500/20 bg-violet-500/10 shrink-0"
            >
              {pageRoute}
            </Badge>

            {currentCode && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 font-medium text-emerald-400 border-emerald-500/20 bg-emerald-500/10 shrink-0 hidden md:inline-flex"
              >
                AI-edited
              </Badge>
            )}
          </div>
        </div>

        {/* Center: Live Preview URL & Quick Actions */}
        <div className="hidden lg:flex items-center gap-1 px-2 py-1 rounded-lg bg-sidebar-accent/30 border border-sidebar-border text-xs max-w-sm w-full mx-4">
          <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="font-mono text-[11px] text-muted-foreground truncate flex-1">
            {previewUrl}
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground rounded"
                onClick={() => setIframeKey((k) => k + 1)}
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reload Preview</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground rounded"
                asChild
              >
                <a href={previewUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Open in New Tab</TooltipContent>
          </Tooltip>
        </div>

        {/* Right Side: Compiler Link, Reset, and AI Assistant Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1.5 px-2.5 hidden sm:flex"
            asChild
          >
            <Link href={`/project/${projectId}/compiler`}>
              <Code2 className="h-3.5 w-3.5" />
              Compiler
            </Link>
          </Button>

          {currentCode && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1 px-2"
              onClick={handleReset}
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Reset</span>
            </Button>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={aiPanelOpen ? "secondary" : "ghost"}
                size="sm"
                className="h-8 text-xs gap-1.5 px-2.5"
                onClick={() => setAiPanelOpen(!aiPanelOpen)}
              >
                <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                <span className="hidden sm:inline">AI Assistant</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>{aiPanelOpen ? "Hide AI Assistant" : "Show AI Assistant"}</TooltipContent>
          </Tooltip>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* MAIN WORKSPACE: Left Sidebar + Center (Preview + Terminal) + Right AI     */}
      {/* ========================================================================= */}
      <div className="flex-1 min-h-0 w-full flex overflow-hidden relative">
        {/* Left: Node Palette Sidebar */}
        <NodePaletteSidebar
          view="graph"
          isOpen={paletteOpen}
          onToggle={() => setPaletteOpen(!paletteOpen)}
        />

        {/* Center: Live Preview Viewport + Docked Terminal at bottom */}
        <div className="flex-1 min-w-0 h-full flex flex-col pointer-events-none overflow-hidden relative">
          {/* Live Preview Iframe Container */}
          <div className="flex-1 min-h-0 w-full relative pointer-events-auto bg-background flex flex-col">
            {/* Mobile/Tablet Preview URL header */}
            <div className="lg:hidden flex items-center justify-between px-3 py-1.5 border-b border-border/30 bg-sidebar/50 text-xs shrink-0">
              <span className="font-mono text-[11px] text-muted-foreground truncate">{previewUrl}</span>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground"
                  onClick={() => setIframeKey((k) => k + 1)}
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground"
                  asChild
                >
                  <a href={previewUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              </div>
            </div>

            {/* Iframe Viewport or Dev Server Offline Placeholder */}
            <div className="flex-1 relative w-full h-full bg-white overflow-hidden">
              {isServerRunning === false ? (
                <DevServerOfflineState
                  projectId={projectId}
                  port={port}
                  pageRoute={pageRoute}
                  pageName={pageName}
                  isChecking={isCheckingServer}
                  onRetry={() => {
                    checkServerStatus();
                    setIframeKey((k) => k + 1);
                  }}
                  onStartServer={handleStartDevServer}
                />
              ) : (
                <iframe
                  key={iframeKey}
                  src={previewUrl}
                  className="w-full h-full border-0"
                  title={`Preview: ${pageName}`}
                />
              )}

              {/* Overlay shown when AI is actively editing */}
              {(streaming || isAiEditing) && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-sm pointer-events-none z-10">
                  <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-background/95 border border-border shadow-2xl">
                    <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
                    <p className="text-sm font-medium text-foreground">AI is editing the page...</p>
                    <p className="text-xs text-muted-foreground text-center max-w-xs">
                      Changes will sync to your monorepo and reload automatically
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

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
          isAiEditing={isAiEditing}
          outputDir={outputDir}
          pageName={pageName}
          onSend={handleSend}
          onReset={currentCode ? handleReset : undefined}
          hasCustomCode={Boolean(currentCode)}
        />
      </div>
    </div>
  );
}
