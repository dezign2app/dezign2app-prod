"use client";

import { useState, useCallback, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "@workspace/backend/_generated/api";
import { Id, Doc } from "@workspace/backend/_generated/dataModel";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { toast } from "sonner";
import {
  JSONValue,
  pageEditorStreamEventSchema,
  type PageEditorStreamEvent,
  type BackendNode,
} from "@workspace/canvas";
import { Message } from "../_components/PageAiPanel";
import { ResolvedCodeResult } from "./usePageCodeSync";

interface UsePageAiEditorOptions {
  projectId: string;
  nodeId: string;
  pageName: string;
  pageRoute: string;
  node: BackendNode | null | undefined;
  convexUrl: string;
  activeConversationId: Id<"conversations"> | null;
  setActiveConversationId: (id: Id<"conversations"> | null) => void;
  convexMessages: Doc<"messages">[] | undefined;
  setTransientMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  updateTitleOnFirstMessage: (convId: Id<"conversations">, prompt: string) => Promise<void>;
  resolveCurrentPageCode: () => Promise<ResolvedCodeResult>;
  writeCodeToDisk: (code: string, targetPath?: string) => Promise<void>;
  onCodeUpdated?: () => void;
}

export function usePageAiEditor({
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
  onCodeUpdated,
}: UsePageAiEditorOptions) {
  const [prompt, setPrompt] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingStatus, setStreamingStatus] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);

  const updateNode = useBackendCanvasStore((s) => s.updateNode);
  const patchNodeData = useMutation(api.canvas.patchNodeData);
  const insertMessageMutation = useMutation(api.ai.messages.insertMessage);

  const isAiEditing = Boolean(node?.data?.aiEditing);
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
    setTransientMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "⏹️ Generation stopped by user.",
        timestamp: new Date(),
      },
    ]);
  }, [node, updateNode, nodeId, patchNodeData, projectId, engineBaseUrl, setTransientMessages]);

  const handleSend = useCallback(async () => {
    if (!prompt.trim() || isAiEditing || streaming) return;

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const userPromptText = prompt.trim();
    setPrompt("");
    setStreaming(true);
    setStreamingContent("");
    setStreamingStatus("Analyzing existing code & planning UI...");

    // Persist user message to Convex immediately for instant UI feedback
    if (activeConversationId) {
      try {
        await insertMessageMutation({
          conversationId: activeConversationId,
          content: userPromptText,
          role: "user",
          createdAt: Date.now(),
        });
        await updateTitleOnFirstMessage(activeConversationId, userPromptText);
      } catch (err) {
        console.warn("[PageEditor] Failed to persist user message in Convex:", err);
      }
    }

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
      // 1. Resolve live code from disk or Convex
      const resolved = await resolveCurrentPageCode();
      const codeToSend = resolved.code || (typeof node?.data?.pageSourceCode === "string" ? node.data.pageSourceCode : "");

      // 2. Fetch Better Auth token for authenticated Convex operations in engine
      let token: string | undefined = undefined;
      try {
        const tokenRes = await fetch("/api/auth/token");
        if (tokenRes.ok) {
          const tokenData = await tokenRes.json();
          token = tokenData.token;
        }
      } catch (e) {
        console.warn("[PageEditor] Non-blocking auth token fetch skipped:", e);
      }

      // 3. Format chat history for context
      const chatHistory = (convexMessages || []).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const engineUrl = `${engineBaseUrl}/page-editor`;
      console.log("[PageEditor] Sending request to engine:", {
        nodeId,
        projectId,
        pageName,
        pageRoute,
        codeLength: codeToSend.length,
        codeSource: resolved.source,
        filePath: resolved.filePath,
        prompt: userPromptText,
        conversationId: activeConversationId,
        historyCount: chatHistory.length,
      });

      const response = await fetch(engineUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortController.signal,
        body: JSON.stringify({
          nodeId,
          projectId,
          currentCode: codeToSend,
          prompt: userPromptText,
          pageName,
          pageRoute,
          convexUrl,
          token,
          conversationId: activeConversationId || undefined,
          chatHistory,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Engine error: ${response.status} ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let finalCode = "";
      let finalPlan = "";
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
            continue;
          }

          const parseResult = pageEditorStreamEventSchema.safeParse(jsonValue);
          if (!parseResult.success) continue;

          const event: PageEditorStreamEvent = parseResult.data;

          if (event.type === "status") {
            setStreamingStatus(event.message);
          } else if (event.type === "token") {
            setStreamingContent((prev) => prev + event.content);
          } else if (event.type === "plan") {
            finalPlan += event.content;
          } else if (event.type === "done") {
            finalCode = event.code;
            if (event.plan) finalPlan = event.plan;
            if (event.conversationId && !activeConversationId) {
              setActiveConversationId(event.conversationId as Id<"conversations">);
            }
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
      await writeCodeToDisk(finalCode, resolved.filePath);

      // Trigger preview reload callback
      if (onCodeUpdated) {
        setTimeout(onCodeUpdated, 1200);
      }
    } catch (err) {
      if ((err instanceof Error && err.name === "AbortError") || abortController.signal.aborted) {
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
      setTransientMessages((prev) => [
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
  }, [
    prompt,
    isAiEditing,
    streaming,
    activeConversationId,
    insertMessageMutation,
    updateTitleOnFirstMessage,
    node,
    nodeId,
    updateNode,
    patchNodeData,
    projectId,
    resolveCurrentPageCode,
    convexMessages,
    engineBaseUrl,
    pageName,
    pageRoute,
    convexUrl,
    setActiveConversationId,
    writeCodeToDisk,
    onCodeUpdated,
    setTransientMessages,
  ]);

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

  return {
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
  };
}
