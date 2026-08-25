"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@workspace/backend/_generated/api";
import { Id } from "@workspace/backend/_generated/dataModel";
import { toast } from "sonner";
import { Message } from "./types";

interface UseProjectChatsOptions {
  projectId: string;
}

export function useProjectChats({ projectId }: UseProjectChatsOptions) {
  const [activeChatId, setActiveChatId] = useState<Id<"project_chats"> | null>(null);
  const [hasInitializedChat, setHasInitializedChat] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  // Fetch all chats for this project
  const chats = useQuery(api.project_chat.getChats, {
    projectId: projectId as Id<"projects">,
  });

  // Fetch messages for active chat
  const convexMessages = useQuery(
    api.project_chat.getMessages,
    activeChatId ? { chatId: activeChatId } : "skip",
  );

  const createChat = useMutation(api.project_chat.createChat);
  const addMessage = useMutation(api.project_chat.addMessage);
  const deleteChatMutation = useMutation(api.project_chat.deleteChat);
  const clearChatMessagesMutation = useMutation(api.project_chat.clearChatMessages);
  const updateChatTitleMutation = useMutation(api.project_chat.updateChatTitle);

  // Initialize activeChatId with first chat if none is active
  useEffect(() => {
    if (chats && !hasInitializedChat) {
      if (chats.length > 0 && !activeChatId && chats[0]?._id) {
        setActiveChatId(chats[0]._id);
      }
      setHasInitializedChat(true);
    }
  }, [chats, hasInitializedChat, activeChatId]);

  // Synchronize messages when convexMessages or activeChatId changes
  useEffect(() => {
    if (convexMessages) {
      if (convexMessages.length > 0) {
        setMessages(
          convexMessages.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
            timestamp: new Date(m.createdAt || m._creationTime),
          })),
        );
      } else {
        setMessages([]);
      }
    } else if (!activeChatId) {
      setMessages([]);
    }
  }, [convexMessages, activeChatId]);

  // Filtered chats based on search query
  const filteredChats = useMemo(() => {
    if (!chats) return [];
    if (!searchQuery.trim()) return chats;
    const q = searchQuery.toLowerCase();
    return chats.filter((c) => c.title?.toLowerCase().includes(q));
  }, [chats, searchQuery]);

  const handleNewChat = useCallback(() => {
    setActiveChatId(null);
    setMessages([]);
    setShowHistory(false);
  }, []);

  const handleSelectChat = useCallback((chatId: Id<"project_chats">) => {
    setActiveChatId(chatId);
    setShowHistory(false);
  }, []);

  const handleDeleteChat = useCallback(
    async (e: React.MouseEvent, chatId: Id<"project_chats">) => {
      e.stopPropagation();
      if (deletingChatId) return;
      setDeletingChatId(chatId);
      try {
        await deleteChatMutation({ chatId });
        if (activeChatId === chatId) {
          setActiveChatId(null);
          setMessages([]);
        }
        toast.success("Conversation deleted");
      } catch (err) {
        console.error("[useProjectChats] Failed to delete chat:", err);
        toast.error("Failed to delete conversation");
      } finally {
        setDeletingChatId(null);
      }
    },
    [deleteChatMutation, activeChatId, deletingChatId]
  );

  const handleClearHistory = useCallback(async () => {
    if (!activeChatId) return;
    try {
      await clearChatMessagesMutation({ chatId: activeChatId });
      setMessages([]);
      toast.success("Chat history cleared");
    } catch (err) {
      console.error("[useProjectChats] Failed to clear chat history:", err);
      toast.error("Failed to clear chat history");
    }
  }, [activeChatId, clearChatMessagesMutation]);

  return {
    chats,
    activeChatId,
    setActiveChatId,
    convexMessages,
    messages,
    setMessages,
    showHistory,
    setShowHistory,
    searchQuery,
    setSearchQuery,
    deletingChatId,
    filteredChats,
    handleNewChat,
    handleSelectChat,
    handleDeleteChat,
    handleClearHistory,
    createChat,
    addMessage,
    updateChatTitleMutation,
  };
}
