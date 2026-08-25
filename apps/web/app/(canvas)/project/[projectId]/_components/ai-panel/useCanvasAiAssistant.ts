"use client";

import { useState, useRef, useCallback } from "react";
import { useReactFlow } from "@xyflow/react";
import { useBackendCanvasStore } from "@/lib/stores/backendCanvasStore";
import { Id } from "@workspace/backend/_generated/dataModel";
import { toast } from "sonner";
import { BackendCanvasView } from "@/types/canvas";
import { Message, SerializedNodeData } from "./types";

interface UseCanvasAiAssistantOptions {
  projectId: string;
  activeChatId: Id<"project_chats"> | null;
  setActiveChatId: (id: Id<"project_chats"> | null) => void;
  convexMessages: any[] | undefined;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  createChat: (args: { projectId: Id<"projects">; title: string }) => Promise<Id<"project_chats">>;
  addMessage: (args: { chatId: Id<"project_chats">; role: "user" | "assistant"; content: string }) => Promise<any>;
  updateChatTitleMutation: (args: { chatId: Id<"project_chats">; title: string }) => Promise<any>;
  setView?: (view: BackendCanvasView) => void;
}

export function serializeBackendCanvasForAI(
  nodes: Array<{ id: string; type: string; data?: SerializedNodeData }>,
  edges: Array<{
    source: string;
    target: string;
    type?: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
  }>,
) {
  if (nodes.length === 0) return "Backend Canvas is empty.";

  let output = "Backend Canvas Nodes:\n";
  for (const node of nodes) {
    const data = node.data ?? {};
    output += `- [${node.type}] id: ${node.id}, label: "${data.label ?? ""}"`;

    if (node.type === "service" && Array.isArray(data.endpoints)) {
      output += "\n  Endpoints:\n";
      output += data.endpoints
        .map((endpoint) => {
          const dbIds: string[] = [
            ...(Array.isArray(endpoint.databaseNodeIds)
              ? endpoint.databaseNodeIds
              : []),
            ...(endpoint.databaseNodeId ? [endpoint.databaseNodeId] : []),
          ];
          const uniqueDbIds = [...new Set(dbIds)];
          const db =
            uniqueDbIds.length > 0
              ? ` databaseNodeIds=[${uniqueDbIds.join(", ")}]`
              : "";
          const epType = endpoint.type ?? "endpoint";
          const epName = endpoint.name ?? "unnamed";
          const epId = endpoint.id ?? "";
          return `    - ${epType} ${epName} id=${epId} sourceHandle="endpoint-out-${epId}" targetHandle="endpoint-in-${epId}"${db}`;
        })
        .join("\n");
    }

    if (node.type === "db_ref") {
      output += `\n  DB reference: tableRef=${data.tableRef ?? "unknown"} targetHandle="database-target"`;
    }
    output += "\n";
  }

  if (edges.length > 0) {
    output += "\nConnections (use these to avoid duplicates):\n";
    for (const edge of edges) {
      output += `- ${edge.source} -> ${edge.target} [${edge.type ?? "connection"}] sourceHandle="${edge.sourceHandle ?? ""}" targetHandle="${edge.targetHandle ?? ""}"\n`;
    }
  }
  return output;
}

export function useCanvasAiAssistant({
  projectId,
  activeChatId,
  setActiveChatId,
  convexMessages,
  setMessages,
  createChat,
  addMessage,
  updateChatTitleMutation,
  setView,
}: UseCanvasAiAssistantOptions) {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingStatus, setStreamingStatus] = useState<string>("");

  const abortControllerRef = useRef<AbortController | null>(null);
  const backendNodes = useBackendCanvasStore((state) => state.nodes);
  const backendEdges = useBackendCanvasStore((state) => state.edges);
  const reactFlow = useReactFlow();

  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setStreamingStatus("");
    toast.info("AI generation stopped");
  }, []);

  const handleSubmit = useCallback(
    async (
      e?: React.FormEvent | React.KeyboardEvent,
      promptOverride?: string,
    ) => {
      if (e) e.preventDefault();
      const userMessage = (promptOverride || input).trim();
      if (!userMessage || isLoading) return;

      setInput("");
      setIsLoading(true);
      setStreamingStatus("Analyzing architecture...");

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      let currentChatId = activeChatId;
      if (!currentChatId) {
        try {
          currentChatId = await createChat({
            projectId: projectId as Id<"projects">,
            title:
              userMessage.substring(0, 40) +
              (userMessage.length > 40 ? "..." : ""),
          });
          setActiveChatId(currentChatId);
        } catch (err) {
          console.error("[useCanvasAiAssistant] Failed to create chat:", err);
          toast.error("Failed to create conversation");
          setIsLoading(false);
          return;
        }
      } else if (!convexMessages || convexMessages.length === 0) {
        updateChatTitleMutation({
          chatId: currentChatId,
          title:
            userMessage.substring(0, 40) +
            (userMessage.length > 40 ? "..." : ""),
        }).catch(() => {});
      }

      const userMsgObj: Message = {
        role: "user",
        content: userMessage,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsgObj]);

      await addMessage({
        chatId: currentChatId,
        role: "user",
        content: userMessage,
      }).catch(console.error);

      try {
        const canvasStateContext = serializeBackendCanvasForAI(
          backendNodes,
          backendEdges,
        );

        const viewportCenter = reactFlow.screenToFlowPosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        });

        const res = await fetch(`${window.location.origin}/api/canvas-ai`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: abortController.signal,
          body: JSON.stringify({
            projectId,
            chatId: currentChatId,
            canvasStateContext,
            viewportCenter,
          }),
        });

        if (!res.ok) throw new Error("API request failed");

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No stream response available");

        const decoder = new TextDecoder();
        let assistantContent = "";

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "",
            isStreaming: true,
            timestamp: new Date(),
          },
        ]);

        while (true) {
          if (abortController.signal.aborted) break;

          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n").filter((l) => l.trim() !== "");

          for (const line of lines) {
            try {
              const data = JSON.parse(line);
              if (data.type === "text") {
                assistantContent += data.content;
                setMessages((prev) => {
                  const newMsgs = [...prev];
                  const lastMsg = newMsgs[newMsgs.length - 1];
                  if (lastMsg && lastMsg.role === "assistant") {
                    lastMsg.content = assistantContent;
                  }
                  return newMsgs;
                });
              } else if (data.type === "tool_call") {
                const argsStr = data.message || "";
                assistantContent += `\n*🔧 Tool used: \`${data.name}\`*${argsStr}\n`;
                setStreamingStatus(`Applying: ${data.name}...`);

                if (setView) {
                  if (
                    data.name === "add_schema_group" ||
                    data.name === "add_single_schema" ||
                    data.name === "add_schema_edge"
                  ) {
                    setView("schema");
                  } else {
                    setView("graph");
                  }
                }

                setMessages((prev) => {
                  const newMsgs = [...prev];
                  const lastMsg = newMsgs[newMsgs.length - 1];
                  if (lastMsg && lastMsg.role === "assistant") {
                    lastMsg.content = assistantContent;
                  }
                  return newMsgs;
                });
              }
            } catch (e) {
              console.error("[useCanvasAiAssistant] Failed to parse chunk line", line);
            }
          }
        }

        setMessages((prev) => {
          const newMsgs = [...prev];
          const lastMsg = newMsgs[newMsgs.length - 1];
          if (lastMsg && lastMsg.role === "assistant") {
            lastMsg.isStreaming = false;
          }
          return newMsgs;
        });

        if (assistantContent && currentChatId && !abortController.signal.aborted) {
          addMessage({
            chatId: currentChatId,
            role: "assistant",
            content: assistantContent,
          }).catch(console.error);
        }
      } catch (error: any) {
        if (error?.name === "AbortError" || abortController.signal.aborted) {
          console.log("[useCanvasAiAssistant] Generation cancelled by user.");
          return;
        }
        console.error("[useCanvasAiAssistant] Submission error:", error);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "Sorry, I encountered an error while designing the architecture. Please try again.",
            timestamp: new Date(),
          },
        ]);
      } finally {
        setIsLoading(false);
        setStreamingStatus("");
        abortControllerRef.current = null;
      }
    },
    [
      input,
      isLoading,
      activeChatId,
      convexMessages,
      createChat,
      projectId,
      setActiveChatId,
      updateChatTitleMutation,
      setMessages,
      addMessage,
      backendNodes,
      backendEdges,
      reactFlow,
      setView,
    ],
  );

  return {
    input,
    setInput,
    isLoading,
    streamingStatus,
    handleSubmit,
    handleStop,
  };
}
