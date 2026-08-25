"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "@workspace/backend/_generated/api";
import { Id } from "@workspace/backend/_generated/dataModel";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { useBackendSync } from "../../_components/hooks/useBackendSync";
import { isElectron, getElectronAPI } from "@/lib/electron";
import { ArrowLeft, ExternalLink, RefreshCw, Sparkles, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@workspace/ui/components/button";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export default function PageEditorPage({
  params,
}: {
  params: Promise<{ projectId: string; nodeId: string }>;
}) {
  const { projectId, nodeId } = React.use(params);
  const router = useRouter();

  // Sync canvas store
  useBackendSync(projectId, "graph");

  const node = useBackendCanvasStore((s) => s.nodes.find((n) => n.id === nodeId));
  const updateNode = useBackendCanvasStore((s) => s.updateNode);
  const nodes = useBackendCanvasStore((s) => s.nodes);
  const edges = useBackendCanvasStore((s) => s.edges);

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
  const pageName = node?.data?.label || nodeId;
  const currentCode = node?.data?.pageSourceCode as string | undefined;
  const isAiEditing = Boolean(node?.data?.aiEditing);

  // Get workspace dir from localStorage (set by terminal folder picker)
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
      ? (window as any).__convexUrl ||
        process.env.NEXT_PUBLIC_CONVEX_URL ||
        ""
      : "";

  // iframe key for forcing reloads
  const [iframeKey, setIframeKey] = useState(0);

  // AI chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [prompt, setPrompt] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

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
            const webAppSlug = (connectedWebAppNode?.data?.appSlug as string) ||
              (connectedWebAppNode?.data?.label as string || "web-app")
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
                { cleanStale: false } // Never delete other files
              );
              toast.success("Page file updated — HMR should reload the preview");
            } catch (e) {
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
      toast.error(err.message || "AI request failed");
      // Clear aiEditing on error
      if (node) {
        updateNode(nodeId, { data: { ...node.data, aiEditing: false } });
      }
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `❌ Error: ${err.message || "AI request failed"}. Make sure the system-design-engine is running (\`pnpm dev\` in apps/system-design-engine).`,
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

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0d1117] text-foreground font-sans">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border/40 bg-[#161b22] shrink-0">
        <button
          onClick={() => router.push(`/project/${projectId}`)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={14} />
          Canvas
        </button>
        <span className="text-border/60">/</span>
        <div className="flex items-center gap-2">
          <Pencil size={13} className="text-indigo-400" />
          <span className="text-sm font-medium text-foreground">{pageName}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            {pageRoute}
          </span>
        </div>

        {currentCode && (
          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            AI-edited
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <Link
            href={`/project/${projectId}/compiler`}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            View in Compiler <ExternalLink size={11} />
          </Link>
          {currentCode && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleReset}
            >
              <Trash2 size={12} className="mr-1" /> Reset to generated
            </Button>
          )}
        </div>
      </div>

      {/* Main split layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left — AI Chat Panel */}
        <div className="w-[340px] shrink-0 flex flex-col border-r border-border/40 bg-[#0d1117]">
          {/* Chat header */}
          <div className="px-4 py-3 border-b border-border/30 flex items-center gap-2">
            <Sparkles size={14} className="text-violet-400" />
            <span className="text-sm font-semibold text-foreground">AI Page Editor</span>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 text-sm">
            {messages.length === 0 && !streaming && (
              <div className="flex flex-col gap-3 py-4">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Describe what you want to change on this page. The AI will edit the
                  TSX code and sync it to all collaborators via Convex.
                </p>
                <div className="space-y-2">
                  {[
                    "Make it a dark sidebar layout",
                    "Add a hero section with gradient",
                    "Convert to a data table with filters",
                    "Add a loading skeleton",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setPrompt(suggestion)}
                      className="w-full text-left text-xs px-2.5 py-1.5 rounded border border-border/50 bg-secondary/20 hover:bg-secondary/40 text-muted-foreground hover:text-foreground transition-all"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
                {!outputDir && (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-400">
                    <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                    <span>
                      No workspace folder set. Open the terminal and pick a folder
                      to enable live disk sync and HMR preview.
                    </span>
                  </div>
                )}
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col gap-1 ${msg.role === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[90%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
                    msg.role === "user"
                      ? "bg-indigo-500/20 text-foreground border border-indigo-500/20 rounded-br-none"
                      : "bg-secondary/40 text-foreground border border-border/40 rounded-bl-none"
                  }`}
                >
                  {msg.content}
                </div>
                <span className="text-[10px] text-muted-foreground/60">
                  {msg.timestamp.toLocaleTimeString()}
                </span>
              </div>
            ))}

            {(streaming || isAiEditing) && (
              <div className="flex flex-col items-start gap-1">
                <div className="max-w-[90%] px-3 py-2 rounded-xl text-xs leading-relaxed bg-secondary/40 text-foreground border border-border/40 rounded-bl-none">
                  {streamingContent ? (
                    <span className="font-mono text-[10px] text-emerald-400 line-clamp-6">
                      {streamingContent.slice(-400)}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                      AI is writing your page...
                    </span>
                  )}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-border/30">
            <div className="flex flex-col gap-2">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                disabled={isAiEditing || streaming}
                placeholder={
                  isAiEditing ? "AI is editing..." : "Describe what to change... (Enter to send)"
                }
                rows={3}
                className="w-full text-xs bg-secondary/20 border border-border/50 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500/50 placeholder:text-muted-foreground/50 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <Button
                onClick={handleSend}
                disabled={!prompt.trim() || isAiEditing || streaming}
                className="w-full h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                <Sparkles size={12} className="mr-1.5" />
                {streaming || isAiEditing ? "AI is editing..." : "Send to AI"}
              </Button>
            </div>
          </div>
        </div>

        {/* Right — Live Preview */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Preview toolbar */}
          <div className="flex items-center gap-3 px-4 py-2 border-b border-border/30 bg-[#161b22] shrink-0">
            <span className="text-xs font-mono text-muted-foreground truncate flex-1">
              {previewUrl}
            </span>
            <button
              onClick={() => setIframeKey((k) => k + 1)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
              title="Reload preview"
            >
              <RefreshCw size={12} />
              Reload
            </button>
            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <ExternalLink size={12} />
              Open
            </a>
          </div>

          {/* iframe */}
          <div className="flex-1 relative bg-white">
            <iframe
              key={iframeKey}
              src={previewUrl}
              className="w-full h-full border-0"
              title={`Preview: ${pageName}`}
              onError={() => {/* handled by iframe content */}}
            />
            {/* Overlay shown when AI is actively editing */}
            {(streaming || isAiEditing) && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-sm pointer-events-none">
                <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-background/90 border border-border/50 shadow-2xl">
                  <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
                  <p className="text-sm font-medium text-foreground">AI is editing the page...</p>
                  <p className="text-xs text-muted-foreground text-center max-w-48">
                    Changes will sync to Convex and the preview will reload automatically
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
