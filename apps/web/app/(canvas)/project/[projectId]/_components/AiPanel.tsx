"use client";

import React, { useState } from "react";
import { Resizable } from "re-resizable";
import { ChevronLeft, Sparkles } from "lucide-react";
import { useSidebarStore } from "@/lib/stores/sidebarStore";
import {
  AiPanelProps,
  useProjectChats,
  useCanvasAiAssistant,
  AiPanelHeader,
  AiPanelHistory,
  AiPanelChatView,
} from "./ai-panel";

export function AiPanel({ projectId, isOpen, onClose, setView }: AiPanelProps) {
  const aiPanelWidth = useSidebarStore((s) => s.aiPanelWidth);
  const setAiPanelWidth = useSidebarStore((s) => s.setAiPanelWidth);
  const setAiPanelOpen = useSidebarStore((s) => s.setAiPanelOpen);
  const [isResizing, setIsResizing] = useState(false);

  // 1. Hook: Manage conversation threads, messages & Convex persistence
  const {
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
  } = useProjectChats({ projectId });

  // 2. Hook: Manage canvas AI streaming, tool calls & submission
  const {
    input,
    setInput,
    isLoading,
    streamingStatus,
    handleSubmit,
    handleStop,
  } = useCanvasAiAssistant({
    projectId,
    activeChatId,
    setActiveChatId,
    convexMessages,
    setMessages,
    createChat,
    addMessage,
    updateChatTitleMutation,
    setView,
  });

  return (
    <>
      {/* Floating Trigger Button on Canvas when AI panel is collapsed */}
      <button
        type="button"
        onClick={() => setAiPanelOpen(true)}
        className={`pointer-events-auto absolute top-3.5 right-3.5 z-30 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sidebar border border-sidebar-border shadow-md text-xs font-semibold text-sidebar-foreground hover:bg-sidebar-accent select-none group transition-all duration-200 ease-in-out ${
          isOpen
            ? "opacity-0 translate-x-4 pointer-events-none scale-95"
            : "opacity-100 translate-x-0 pointer-events-auto scale-100"
        }`}
        title="Open AI Assistant"
      >
        <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground group-hover:-translate-x-0.5 transition-transform" />
        <Sparkles className="w-4 h-4 text-muted-foreground group-hover:text-sidebar-foreground transition-colors" />
        <span className="font-semibold text-[11px]">AI Assistant</span>
      </button>

      {/* Resizable Sidebar Panel */}
      <Resizable
        size={{ width: isOpen ? aiPanelWidth : 0, height: "100%" }}
        minWidth={isOpen ? 280 : 0}
        maxWidth={800}
        enable={{ left: isOpen }}
        onResizeStart={() => setIsResizing(true)}
        onResizeStop={(e, direction, ref, d) => {
          setIsResizing(false);
          setAiPanelWidth(aiPanelWidth + d.width);
        }}
        handleClasses={{
          left: "w-1.5 bg-sidebar-border hover:bg-muted-foreground/40 cursor-col-resize transition-colors z-30 hover:w-2",
        }}
        className={`h-full pointer-events-auto shrink-0 flex flex-col bg-sidebar border-l border-sidebar-border shadow-lg z-20 select-none font-sans overflow-hidden ${
          isResizing
            ? ""
            : "transition-[width,opacity] duration-200 ease-in-out"
        } ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none border-l-0"
        }`}
      >
        {/* Top Header */}
        <AiPanelHeader
          showHistory={showHistory}
          chatsCount={chats?.length}
          hasMessages={messages.length > 0}
          isLoading={isLoading}
          onBackToChat={() => setShowHistory(false)}
          onOpenHistory={() => setShowHistory(true)}
          onNewChat={handleNewChat}
          onClearHistory={activeChatId ? handleClearHistory : undefined}
          onClose={onClose}
        />

        {/* Body: Conversation History View OR Active Chat View */}
        {showHistory ? (
          <AiPanelHistory
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            chats={chats}
            filteredChats={filteredChats}
            activeChatId={activeChatId}
            deletingChatId={deletingChatId}
            onSelectChat={handleSelectChat}
            onDeleteChat={handleDeleteChat}
            onNewChat={handleNewChat}
          />
        ) : (
          <AiPanelChatView
            messages={messages}
            input={input}
            setInput={setInput}
            isLoading={isLoading}
            streamingStatus={streamingStatus}
            onSubmit={handleSubmit}
            onStop={handleStop}
          />
        )}
      </Resizable>
    </>
  );
}

export * from "./ai-panel";
