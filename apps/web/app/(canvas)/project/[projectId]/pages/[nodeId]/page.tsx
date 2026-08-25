"use client";

import React, { useState, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
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
import {
  JSONValue,
  pageEditorStreamEventSchema,
  type PageEditorStreamEvent,
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
  const patchNodeData = useMutation(api.canvas.patchNodeData);

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
  const rawLabel = typeof node?.data?.label === "string" ? node.data.label : "";
  const pageRoute = pageRouteToUrl(rawLabel);
  const pageFolderSlug = pageRouteToFolderPath(rawLabel);
  const pageName = parsePageRoute(rawLabel) || nodeId;
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

  // Helper to resolve the live code context from disk or Convex
  const resolveCurrentPageCode = useCallback(async (): Promise<{
    code: string;
    source: "disk" | "convex" | "none";
    filePath: string;
  }> => {
    const rawSlug = typeof connectedWebAppNode?.data?.appSlug === "string" ? connectedWebAppNode.data.appSlug : "";
    const rawLabel = typeof connectedWebAppNode?.data?.label === "string" ? connectedWebAppNode.data.label : "web-app";
    const webAppSlug = (rawSlug || rawLabel).toLowerCase().replace(/[^a-z0-9]+/g, "-");

    const isRoot = !pageFolderSlug || pageFolderSlug === "/" || pageFolderSlug === "page" || pageFolderSlug === "(public)";

    const candidatePaths: string[] = [
      // Standard Monorepo root paths (used by Blueprint monorepo exports)
      isRoot ? `apps/${webAppSlug}/app/(public)/page.tsx` : `apps/${webAppSlug}/app/(public)/${pageFolderSlug}/page.tsx`,
      isRoot ? `apps/${webAppSlug}/app/(${webAppSlug})/page.tsx` : `apps/${webAppSlug}/app/(${webAppSlug})/${pageFolderSlug}/page.tsx`,
      isRoot ? `apps/${webAppSlug}/app/(${pageFolderSlug})/page.tsx` : `apps/${webAppSlug}/app/(${pageFolderSlug})/page.tsx`,
      isRoot ? `apps/${webAppSlug}/app/page.tsx` : `apps/${webAppSlug}/app/${pageFolderSlug}/page.tsx`,
      // Direct WebApp folder paths
      isRoot ? `app/(public)/page.tsx` : `app/(public)/${pageFolderSlug}/page.tsx`,
      isRoot ? `app/(${webAppSlug})/page.tsx` : `app/(${webAppSlug})/${pageFolderSlug}/page.tsx`,
      isRoot ? `app/(${pageFolderSlug})/page.tsx` : `app/(${pageFolderSlug})/page.tsx`,
      isRoot ? `app/page.tsx` : `app/${pageFolderSlug}/page.tsx`,
    ];

    const defaultFilePath = isRoot
      ? `apps/${webAppSlug}/app/(public)/page.tsx`
      : `apps/${webAppSlug}/app/(public)/${pageFolderSlug}/page.tsx`;

    // 1. Try reading the live file from disk via Electron
    if (isElectron() && outputDir) {
      const electronApi = getElectronAPI();
      if (electronApi?.fs?.readFile) {
        for (const relPath of candidatePaths) {
          try {
            const res = await electronApi.fs.readFile(outputDir, relPath);
            if (res?.success && typeof res.content === "string" && res.content.trim().length > 0) {
              console.log(`[PageEditor] Loaded live code from disk (${res.path}): ${res.content.length} chars`);
              return { code: res.content, source: "disk", filePath: relPath };
            }
          } catch {}
        }
      }
    }

    // 2. Try Convex stored pageSourceCode
    if (node?.data?.pageSourceCode && typeof node.data.pageSourceCode === "string" && node.data.pageSourceCode.trim().length > 0) {
      console.log(`[PageEditor] Loaded code from Convex node data: ${node.data.pageSourceCode.length} chars`);
      return { code: node.data.pageSourceCode, source: "convex", filePath: defaultFilePath };
    }

    return { code: "", source: "none", filePath: defaultFilePath };
  }, [connectedWebAppNode, pageFolderSlug, outputDir, node]);

  // AI chat state & abort controller
  const [messages, setMessages] = useState<Message[]>([]);
  const [prompt, setPrompt] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingStatus, setStreamingStatus] = useState("");
  const abortControllerRef = React.useRef<AbortController | null>(null);

  const engineBaseUrl = process.env.NEXT_PUBLIC_SYSTEM_DESIGN_ENGINE_URL || "http://localhost:3002";

  const handleStop = useCallback(async () => {
    console.log(`[PageEditor] ⏹️ User clicked STOP button for node: "${nodeId}"`);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      console.log(`[PageEditor] ⏹️ Aborted browser stream fetch reader.`);
    }

    // Explicitly notify the backend engine to terminate the LangGraph pipeline
    fetch(`${engineBaseUrl}/page-editor/stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodeId, projectId }),
    })
      .then((res) => res.json())
      .then((data) => {
        console.log(`[PageEditor] ⏹️ Server response from /page-editor/stop:`, data);
      })
      .catch((err) => {
        console.warn("[PageEditor] Non-blocking /stop notify error:", err);
      });

    setStreaming(false);
    setStreamingContent("");
    setStreamingStatus("");
    if (node) {
      updateNode(nodeId, { data: { ...node.data, aiEditing: false } });
    }
    try {
      await patchNodeData({
        projectId: projectId as Id<"projects">,
        nodeId,
        patch: { aiEditing: false },
      });
    } catch {}
    toast.info("AI generation stopped");
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "⏹️ Generation stopped by user.",
        timestamp: new Date(),
      },
    ]);
  }, [node, updateNode, nodeId, patchNodeData, projectId, engineBaseUrl]);

  const handleSend = useCallback(async () => {
    if (!prompt.trim() || isAiEditing || streaming) return;

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

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
    setStreamingStatus("Analyzing existing code & planning UI...");

    // Mark node as AI-editing in store (optimistic) and sync to Convex
    if (node) {
      updateNode(nodeId, { data: { ...node.data, aiEditing: true } });
    }
    patchNodeData({
      projectId: projectId as Id<"projects">,
      nodeId,
      patch: { aiEditing: true },
    }).catch((err) => {
      console.warn("[PageEditor] Non-blocking lock sync error:", err);
    });

    try {
      // 1. Resolve live code from disk or Convex so the AI has 100% current code context
      const resolved = await resolveCurrentPageCode();
      const codeToSend = resolved.code || (typeof node?.data?.pageSourceCode === "string" ? node.data.pageSourceCode : "");

      const engineUrl = `${engineBaseUrl}/page-editor`;
      console.log("[PageEditor] Sending request to engine:", {
        nodeId,
        projectId,
        pageName,
        pageRoute,
        codeLength: codeToSend.length,
        codeSource: resolved.source,
        filePath: resolved.filePath,
        prompt: userMsg.content,
      });

      const response = await fetch(engineUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortController.signal,
        body: JSON.stringify({
          nodeId,
          projectId,
          currentCode: codeToSend,
          prompt: userMsg.content,
          pageName,
          pageRoute,
          convexUrl,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Engine error: ${response.status} ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let finalCode = "";
      let buffer = "";

      while (true) {
        if (abortController.signal.aborted) break;

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          let jsonValue: JSONValue;
          try {
            jsonValue = JSON.parse(line);
          } catch {
            // Incomplete JSON chunk in buffer, skip until next read
            continue;
          }

          const parseResult = pageEditorStreamEventSchema.safeParse(jsonValue);
          if (!parseResult.success) {
            continue;
          }

          const event: PageEditorStreamEvent = parseResult.data;

          console.log(
            "[PageEditor] Stream event:",
            event.type,
            "message" in event
              ? event.message
              : "content" in event
                ? `${event.content.length} chars`
                : ""
          );

          if (event.type === "status") {
            setStreamingStatus(event.message);
          } else if (event.type === "token") {
            setStreamingContent((prev) => prev + event.content);
          } else if (event.type === "plan") {
            // Optional: plan streaming
          } else if (event.type === "done") {
            finalCode = event.code;
          } else if (event.type === "error") {
            throw new Error(event.message || "Engine returned error");
          }
        }
      }

      if (abortController.signal.aborted) {
        console.log("[PageEditor] Aborted stream read.");
        return;
      }

      if (!finalCode) {
        throw new Error("UI generation finished without producing code. Please check system-design-engine terminal logs.");
      }

      console.log(`[PageEditor] UI generation finished successfully! Code length: ${finalCode.length} chars`);

      if (finalCode) {
        // Update local store immediately
        if (node) {
          updateNode(nodeId, {
            data: {
              ...node.data,
              pageSourceCode: finalCode,
              aiEditing: false,
            },
          });
        }

        // Persist code to Convex from authenticated browser client
        try {
          await patchNodeData({
            projectId: projectId as Id<"projects">,
            nodeId,
            patch: {
              pageSourceCode: finalCode,
              aiEditing: false,
            },
          });
        } catch (convexErr) {
          console.warn("[PageEditor] Failed to sync generated code to Convex:", convexErr);
        }

        // Write to local disk via Electron bridge for HMR
        if (isElectron() && outputDir) {
          const electronApi = getElectronAPI();
          if (electronApi?.fs?.writeProject) {
            const rawSlug = typeof connectedWebAppNode?.data?.appSlug === "string" ? connectedWebAppNode.data.appSlug : "";
            const rawLabel = typeof connectedWebAppNode?.data?.label === "string" ? connectedWebAppNode.data.label : "web-app";
            const webAppSlug = (rawSlug || rawLabel).toLowerCase().replace(/[^a-z0-9]+/g, "-");

            const isRoot = !pageFolderSlug || pageFolderSlug === "/" || pageFolderSlug === "page" || pageFolderSlug === "(public)";

            const targetFilePath = resolved.filePath || (isRoot
              ? `apps/${webAppSlug}/app/(public)/page.tsx`
              : `apps/${webAppSlug}/app/(public)/${pageFolderSlug}/page.tsx`);

            try {
              await electronApi.fs.writeProject(
                outputDir,
                [{ filename: targetFilePath, content: finalCode }],
                { cleanStale: false }
              );
              toast.success(`Page updated on disk (${targetFilePath}) — HMR should reload`);
            } catch (diskErr) {
              console.warn("[PageEditor] Failed to write to disk:", diskErr);
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
    } catch (err: any) {
      if (err?.name === "AbortError" || abortController.signal.aborted) {
        console.log("[PageEditor] Generation cancelled by user.");
        return;
      }
      const errorMessage = err instanceof Error ? err.message : "AI request failed";
      console.error("[PageEditor] handleSend error:", err);
      toast.error(errorMessage);
      if (node) {
        updateNode(nodeId, { data: { ...node.data, aiEditing: false } });
      }
      try {
        await patchNodeData({
          projectId: projectId as Id<"projects">,
          nodeId,
          patch: { aiEditing: false },
        });
      } catch (e) {
        console.warn("[PageEditor] Failed to sync unlock to Convex on error:", e);
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
      setStreamingStatus("");
      abortControllerRef.current = null;
    }
  }, [prompt, isAiEditing, streaming, nodeId, projectId, currentCode, pageName, convexUrl, node, updateNode, outputDir, connectedWebAppNode, pageFolderSlug, patchNodeData, resolveCurrentPageCode]);

  const handleUnlock = async () => {
    if (node) {
      updateNode(nodeId, { data: { ...node.data, aiEditing: false } });
    }
    setStreaming(false);
    setStreamingContent("");
    setStreamingStatus("");
    try {
      await patchNodeData({
        projectId: projectId as Id<"projects">,
        nodeId,
        patch: { aiEditing: false },
      });
    } catch (e) {
      console.warn("[PageEditor] Failed to sync unlock to Convex:", e);
    }
    toast.success("Page unlocked");
  };

  const handleReset = () => {
    if (!node) return;
    if (!window.confirm("Reset to compiler-generated page? This will delete the AI-edited version.")) return;
    updateNode(nodeId, {
      data: { ...node.data, pageSourceCode: undefined, aiEditing: false },
    });
    try {
      patchNodeData({
        projectId: projectId as Id<"projects">,
        nodeId,
        patch: { pageSourceCode: undefined, aiEditing: false },
      });
    } catch (e) {}
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
          streamingStatus={streamingStatus}
          isAiEditing={isAiEditing}
          outputDir={outputDir}
          pageName={pageName}
          onSend={handleSend}
          onStop={handleStop}
          onReset={currentCode ? handleReset : undefined}
          onUnlock={handleUnlock}
          hasCustomCode={Boolean(currentCode)}
        />
      </div>
    </div>
  );
}
