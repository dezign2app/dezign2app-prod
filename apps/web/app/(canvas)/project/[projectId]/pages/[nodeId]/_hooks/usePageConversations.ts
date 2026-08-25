"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@workspace/backend/_generated/api";
import { Id } from "@workspace/backend/_generated/dataModel";
import { toast } from "sonner";
import { Message } from "../_components/PageAiPanel";

interface UsePageConversationsOptions {
  projectId: string;
  nodeId: string;
  pageName: string;
}

export function usePageConversations({
  projectId,
  nodeId,
  pageName,
}: UsePageConversationsOptions) {
  const [activeConversationId, setActiveConversationId] = useState<Id<"conversations"> | null>(null);
  const [transientMessages, setTransientMessages] = useState<Message[]>([]);

  const getOrCreateConv = useMutation(api.ai.conversations.getOrCreateNodeConversation);
  const startConversationMutation = useMutation(api.ai.conversations.startConversation);
  const deleteConversationMutation = useMutation(api.ai.conversations.deleteConversation);
  const updateConversationTitleMutation = useMutation(api.ai.conversations.updateConversationTitle);
  const clearHistoryMutation = useMutation(api.ai.conversations.clearConversationMessages);

  const convexMessages = useQuery(
    api.ai.messages.getConversationMessages,
    activeConversationId ? { conversationId: activeConversationId } : "skip"
  );

  // Initialize/get conversation ID for this page node if none active
  useEffect(() => {
    if (projectId && nodeId && !activeConversationId) {
      getOrCreateConv({
        projectId: projectId as Id<"projects">,
        nodeId,
        type: "ui_design",
        title: `UI Design: ${pageName || nodeId}`,
      })
        .then((id) => {
          setActiveConversationId(id);
        })
        .catch((err) => {
          console.warn("[PageEditor] Could not get or create node conversation:", err);
        });
    }
  }, [projectId, nodeId, pageName, getOrCreateConv, activeConversationId]);

  // Combined messages from Convex + transient errors / stop notices
  const messages = useMemo<Message[]>(() => {
    const persisted: Message[] = (convexMessages || []).map((m) => ({
      id: m._id,
      role: (m.role === "USER" || m.role === "user") ? "user" : "assistant",
      content: m.content,
      timestamp: new Date(m.createdAt ?? m._creationTime),
    }));
    return [...persisted, ...transientMessages];
  }, [convexMessages, transientMessages]);

  const handleSelectConversation = useCallback((convId: string) => {
    setActiveConversationId(convId as Id<"conversations">);
    setTransientMessages([]);
  }, []);

  const handleNewConversation = useCallback(async () => {
    try {
      const convId = await startConversationMutation({
        projectId: projectId as Id<"projects">,
        nodeId,
        type: "ui_design",
        title: `UI Design: ${pageName || nodeId} (${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`,
      });
      setActiveConversationId(convId);
      setTransientMessages([]);
      toast.success("Started new conversation");
    } catch (e) {
      console.error("[PageEditor] Failed to start new conversation:", e);
      toast.error("Failed to start new conversation");
    }
  }, [startConversationMutation, projectId, nodeId, pageName]);

  const handleDeleteConversation = useCallback(async (convId: string) => {
    try {
      await deleteConversationMutation({ conversationId: convId as Id<"conversations"> });
      if (activeConversationId === convId) {
        setActiveConversationId(null);
        setTransientMessages([]);
      }
      toast.success("Conversation deleted");
    } catch (e) {
      console.error("[PageEditor] Failed to delete conversation:", e);
      toast.error("Failed to delete conversation");
    }
  }, [deleteConversationMutation, activeConversationId]);

  const handleClearHistory = useCallback(async () => {
    if (!activeConversationId) return;
    try {
      await clearHistoryMutation({ conversationId: activeConversationId });
      setTransientMessages([]);
      toast.success("Chat history cleared");
    } catch (e) {
      console.error("[PageEditor] Failed to clear chat history:", e);
      toast.error("Failed to clear chat history");
    }
  }, [activeConversationId, clearHistoryMutation]);

  const updateTitleOnFirstMessage = useCallback(async (convId: Id<"conversations">, userPromptText: string) => {
    if (!convexMessages || convexMessages.length <= 1) {
      try {
        await updateConversationTitleMutation({
          conversationId: convId,
          title: userPromptText.slice(0, 45) + (userPromptText.length > 45 ? "..." : ""),
        });
      } catch {}
    }
  }, [convexMessages, updateConversationTitleMutation]);

  return {
    activeConversationId,
    setActiveConversationId,
    convexMessages,
    messages,
    transientMessages,
    setTransientMessages,
    handleSelectConversation,
    handleNewConversation,
    handleDeleteConversation,
    handleClearHistory,
    updateTitleOnFirstMessage,
  };
}
