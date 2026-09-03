"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { Resizable } from "re-resizable";
import {
  Sparkles,
  Trash,
  ChevronLeft,
  ArrowLeft,
  AlertTriangle,
  Send,
  Loader2,
  RefreshCw,
  Unlock,
  Square,
  History,
  Plus,
  MessageSquare,
  Search,
  Clock,
  Layers,
  Wand2,
  Code2,
  X,
} from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";
import { useSidebarStore } from "@/lib/stores/sidebarStore";
import { useQuery } from "convex/react";
import { api } from "@workspace/backend/_generated/api";
import { Id } from "@workspace/backend/_generated/dataModel";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  plan?: string;
  timestamp: Date;
}

interface PageAiPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  messages: Message[];
  prompt: string;
  setPrompt: (prompt: string) => void;
  streaming: boolean;
  streamingContent: string;
  streamingStatus?: string;
  isAiEditing: boolean;
  outputDir: string;
  pageName: string;
  activeFilePath?: string;
  onSend: () => void;
  onStop?: () => void;
  onReset?: () => void;
  onUnlock?: () => void;
  onClearHistory?: () => void;
  hasCustomCode?: boolean;
  projectId?: string;
  nodeId?: string;
  activeConversationId?: string | null;
  onSelectConversation?: (conversationId: string) => void;
  onNewConversation?: () => void;
  onDeleteConversation?: (conversationId: string) => void;
  onApplyCodeToEditor?: (code: string) => void;
}

const QUICK_ACTIONS = [
  {
    label: "Modern Dark Hero",
    prompt: "Create a sleek dark modern hero section with glowing gradient accents, headline, CTA buttons, and feature badges.",
  },
  {
    label: "Data Table & Filters",
    prompt: "Build a responsive data table with status badges, search filter input, sorting controls, and pagination.",
  },
  {
    label: "Card Grid & Stats",
    prompt: "Add a grid of interactive metric cards with growth badges, trend icons, and smooth hover elevation.",
  },
  {
    label: "Form with Validation",
    prompt: "Create an interactive input form with clean validation states, error messages, and a submit button with loading state.",
  },
  {
    label: "Navbar & Footer",
    prompt: "Add a modern sticky navbar with logo and navigation links, plus a clean footer with social links and copyright.",
  },
  {
    label: "Fix Styling / Alignment",
    prompt: "Review and refine the Tailwind layout, spacing, typography, and responsive breakpoints for a polished look.",
  },
];

export function PageAiPanel({
  isOpen,
  onToggle,
  messages,
  prompt,
  setPrompt,
  streaming,
  streamingContent,
  streamingStatus,
  isAiEditing,
  outputDir,
  pageName,
  activeFilePath,
  onSend,
  onStop,
  onReset,
  onUnlock,
  onClearHistory,
  hasCustomCode,
  projectId,
  nodeId,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
}: PageAiPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const aiPanelWidth = useSidebarStore((s) => s.aiPanelWidth);
  const setAiPanelWidth = useSidebarStore((s) => s.setAiPanelWidth);
  const [isResizing, setIsResizing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [historyScope, setHistoryScope] = useState<"page" | "all">("page");
  const [deletingConvId, setDeletingConvId] = useState<string | null>(null);

  // Fetch conversations for this page node
  const pageConversations = useQuery(
    api.ai.conversations.listNodeConversations,
    projectId && nodeId
      ? {
          projectId: projectId as Id<"projects">,
          nodeId,
          type: "ui_design",
        }
      : "skip"
  );

  // Fetch all UI design conversations in this project
  const allProjectConversations = useQuery(
    api.ai.conversations.listConversationsByProject,
    projectId
      ? {
          projectId: projectId as Id<"projects">,
          type: "ui_design",
        }
      : "skip"
  );

  const activeConvList = historyScope === "page" ? pageConversations : allProjectConversations;

  const filteredConversations = useMemo(() => {
    if (!activeConvList) return [];
    if (!searchQuery.trim()) return activeConvList;
    const q = searchQuery.toLowerCase();
    return activeConvList.filter((c) =>
      c.title?.toLowerCase().includes(q)
    );
  }, [activeConvList, searchQuery]);

  useEffect(() => {
    if (!showHistory) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, streamingContent, showHistory]);

  const handleDeleteConv = async (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    if (deletingConvId) return;
    setDeletingConvId(convId);
    try {
      if (onDeleteConversation) {
        await onDeleteConversation(convId);
      }
    } finally {
      setDeletingConvId(null);
    }
  };

  const handleSelectConv = (convId: string) => {
    if (onSelectConversation) {
      onSelectConversation(convId);
    }
    setShowHistory(false);
  };

  const handleCreateNewConv = () => {
    if (onNewConversation) {
      onNewConversation();
    }
    setShowHistory(false);
  };

  const handleQuickAction = (quickPrompt: string) => {
    setPrompt(quickPrompt);
  };

  return (
    <>
      {/* Floating Trigger Button when closed */}
      <button
        type="button"
        onClick={onToggle}
        className={`pointer-events-auto absolute top-3 right-3 z-30 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sidebar border border-sidebar-border shadow-md text-xs font-semibold text-sidebar-foreground hover:bg-sidebar-accent select-none group transition-all duration-200 ease-in-out ${
          isOpen
            ? "opacity-0 translate-x-4 pointer-events-none scale-95"
            : "opacity-100 translate-x-0 pointer-events-auto scale-100"
        }`}
        title="Open AI Assistant"
      >
        <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground group-hover:-translate-x-0.5 transition-transform" />
        <Sparkles className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
        <span className="font-semibold text-[11px]">AI Assistant</span>
      </button>

      {/* Resizable Sidebar Panel */}
      <Resizable
        size={{ width: isOpen ? aiPanelWidth : 0, height: "100%" }}
        minWidth={isOpen ? 300 : 0}
        maxWidth={800}
        enable={{ left: isOpen }}
        onResizeStart={() => setIsResizing(true)}
        onResizeStop={(e, direction, ref, d) => {
          setIsResizing(false);
          setAiPanelWidth(aiPanelWidth + d.width);
        }}
        handleClasses={{
          left: "w-1.5 bg-sidebar-border hover:bg-primary/50 cursor-col-resize transition-colors z-30",
        }}
        className={`h-full pointer-events-auto shrink-0 flex flex-col bg-sidebar border-l border-sidebar-border shadow-lg z-20 select-none font-sans overflow-hidden ${
          isResizing
            ? ""
            : "transition-[width,opacity] duration-200 ease-in-out"
        } ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none border-l-0"
        }`}
      >
        {/* ========================================================================= */}
        {/* HEADER: Dynamic based on Chat vs History View                            */}
        {/* ========================================================================= */}
        <div className="h-10 px-3 border-b border-sidebar-border flex items-center justify-between shrink-0 bg-sidebar-accent/40">
          {showHistory ? (
            /* History Header */
            <>
              <div className="flex items-center gap-2 min-w-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent rounded"
                      onClick={() => setShowHistory(false)}
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Back to Chat</TooltipContent>
                </Tooltip>
                <div className="flex items-center gap-1.5 truncate">
                  <History className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs font-semibold tracking-wide text-sidebar-foreground truncate">
                    Conversations
                  </span>
                  {activeConvList && (
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-sidebar-accent text-muted-foreground border border-sidebar-border">
                      {activeConvList.length}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[11px] text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent px-2 gap-1"
                      onClick={handleCreateNewConv}
                    >
                      <Plus className="w-3 h-3" />
                      <span>New</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Start new conversation</TooltipContent>
                </Tooltip>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent rounded"
                  onClick={onToggle}
                  title="Collapse AI Panel"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </>
          ) : (
            /* Chat Header */
            <>
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="w-4 h-4 text-primary shrink-0" />
                <span className="text-xs font-semibold tracking-wide uppercase text-sidebar-foreground truncate">
                  AI Code Agent
                </span>
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-primary/10 text-primary border-primary/30 shrink-0 font-normal">
                  Live Sync
                </Badge>
              </div>
              <div className="flex items-center gap-1">
                {/* Conversation History List Toggle */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent rounded"
                      onClick={() => setShowHistory(true)}
                    >
                      <History className="w-3.5 h-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Conversation History</TooltipContent>
                </Tooltip>

                {/* New Chat Button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent rounded"
                      onClick={handleCreateNewConv}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>New Conversation</TooltipContent>
                </Tooltip>

                {/* Clear Current Chat History */}
                {messages.length > 0 && onClearHistory && !streaming && !isAiEditing && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded"
                        onClick={onClearHistory}
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Clear current messages</TooltipContent>
                  </Tooltip>
                )}

                {/* Collapse Panel */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent rounded"
                      onClick={onToggle}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Collapse AI Panel</TooltipContent>
                </Tooltip>
              </div>
            </>
          )}
        </div>

        {/* ========================================================================= */}
        {/* BODY: History View OR Active Chat View                                   */}
        {/* ========================================================================= */}
        {showHistory ? (
          /* CONVERSATION HISTORY LIST VIEW */
          <div className="flex-1 flex flex-col min-h-0 bg-sidebar">
            {/* Search & Scope Filter Bar */}
            <div className="p-2.5 border-b border-sidebar-border space-y-2 bg-sidebar">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search conversations..."
                  className="w-full text-xs bg-sidebar-accent border border-sidebar-border rounded-md pl-8 pr-3 py-1.5 text-sidebar-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-sidebar-ring"
                />
              </div>

              {/* Scope Switcher Tabs */}
              <div className="flex items-center gap-1 p-0.5 rounded-md bg-sidebar-accent border border-sidebar-border text-[11px]">
                <button
                  type="button"
                  onClick={() => setHistoryScope("page")}
                  className={`flex-1 py-1 px-2 rounded font-medium text-center transition-colors ${
                    historyScope === "page"
                      ? "bg-sidebar text-sidebar-foreground shadow-sm"
                      : "text-muted-foreground hover:text-sidebar-foreground"
                  }`}
                >
                  This Page
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryScope("all")}
                  className={`flex-1 py-1 px-2 rounded font-medium text-center transition-colors ${
                    historyScope === "all"
                      ? "bg-sidebar text-sidebar-foreground shadow-sm"
                      : "text-muted-foreground hover:text-sidebar-foreground"
                  }`}
                >
                  All Project Pages
                </button>
              </div>
            </div>

            {/* Conversations List Scroll Area */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {activeConvList === undefined ? (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  <span className="text-xs">Loading conversations...</span>
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-52 text-center p-4 text-muted-foreground gap-2.5">
                  <div className="w-10 h-10 rounded-full bg-sidebar-accent border border-sidebar-border flex items-center justify-center text-muted-foreground">
                    <History className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-sidebar-foreground">No conversations found</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {searchQuery
                        ? "Try matching different keywords"
                        : "Start a conversation to design and generate your page"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-sidebar-border bg-sidebar hover:bg-sidebar-accent text-sidebar-foreground mt-1"
                    onClick={handleCreateNewConv}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Start New Conversation
                  </Button>
                </div>
              ) : (
                filteredConversations.map((conv) => {
                  const isActive = conv._id === activeConversationId;
                  const isDeleting = deletingConvId === conv._id;

                  return (
                    <div
                      key={conv._id}
                      onClick={() => handleSelectConv(conv._id)}
                      className={`group relative flex flex-col gap-1.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                        isActive
                          ? "bg-sidebar-accent border-sidebar-border text-sidebar-foreground shadow-sm"
                          : "bg-sidebar hover:bg-sidebar-accent/50 border-sidebar-border/70 hover:border-sidebar-border text-muted-foreground hover:text-sidebar-foreground"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <MessageSquare className="w-3.5 h-3.5 shrink-0 text-primary" />
                          <span className={`text-xs truncate ${isActive ? "text-sidebar-foreground font-semibold" : "text-sidebar-foreground"}`}>
                            {conv.title || "Untitled Conversation"}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {isActive && (
                            <Badge
                              variant="outline"
                              className="text-[9px] px-1.5 py-0 h-4 bg-sidebar text-sidebar-foreground border-sidebar-border font-normal"
                            >
                              Current
                            </Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={isDeleting}
                            onClick={(e) => handleDeleteConv(e, conv._id)}
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded"
                            title="Delete conversation"
                          >
                            {isDeleting ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Trash className="w-3 h-3" />
                            )}
                          </Button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-muted-foreground pl-5">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          <span>
                            {formatDistanceToNow(new Date(conv.updatedAt || conv._creationTime), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                        {historyScope === "all" && conv.nodeId && (
                          <div className="flex items-center gap-1 text-[9px] bg-sidebar-accent px-1.5 py-0.5 rounded border border-sidebar-border text-muted-foreground">
                            <Layers className="w-2.5 h-2.5" />
                            <span className="truncate max-w-[100px]">{conv.nodeId}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom New Chat Action Bar in History Mode */}
            <div className="p-2.5 border-t border-sidebar-border bg-sidebar shrink-0">
              <Button
                type="button"
                onClick={handleCreateNewConv}
                className="w-full h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" /> Start New Conversation
              </Button>
            </div>
          </div>
        ) : (
          /* ACTIVE CHAT VIEW */
          <>
            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs bg-sidebar">
              {messages.length === 0 && !streaming && (
                <div className="flex flex-col gap-3 py-2">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-sidebar-foreground flex items-center gap-1.5">
                      <Wand2 className="w-3.5 h-3.5 text-primary" />
                      AI Assistant for <span className="text-primary">{pageName}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Instruct the AI agent to edit TSX code, build responsive UI components, or fix styling. Changes will update the code editor and write to disk in real time.
                    </p>
                  </div>

                  {/* Preset Action Chips */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Quick UI Actions
                    </span>
                    <div className="grid grid-cols-1 gap-1.5">
                      {QUICK_ACTIONS.map((action) => (
                        <button
                          key={action.label}
                          type="button"
                          onClick={() => handleQuickAction(action.prompt)}
                          className="w-full text-left p-2 rounded-lg border border-sidebar-border bg-sidebar-accent/40 hover:bg-sidebar-accent hover:border-primary/40 text-sidebar-foreground transition-all group"
                        >
                          <div className="flex items-center justify-between text-xs font-medium">
                            <span className="group-hover:text-primary transition-colors">
                              {action.label}
                            </span>
                            <Sparkles className="w-3 h-3 text-muted-foreground group-hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                            {action.prompt}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {!outputDir && (
                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
                      <span>
                        No local folder selected. Pick your local repository folder in the terminal to enable instant file sync & HMR.
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
                        ? "bg-primary text-primary-foreground rounded-br-none"
                        : "bg-sidebar-accent text-sidebar-foreground border border-sidebar-border rounded-bl-none shadow-sm"
                    }`}
                  >
                    {msg.plan && (
                      <div className="mb-2 p-2 rounded bg-sidebar/70 border border-sidebar-border/80 text-[11px] font-mono text-muted-foreground">
                        <div className="flex items-center gap-1 text-primary font-semibold mb-1">
                          <Code2 className="w-3 h-3" /> Plan:
                        </div>
                        <p className="whitespace-pre-wrap">{msg.plan}</p>
                      </div>
                    )}
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground px-1 font-mono">
                    {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}

              {(streaming || isAiEditing) && (
                <div className="flex flex-col items-start gap-1">
                  <div className="max-w-[95%] w-full px-3 py-2.5 rounded-xl text-xs leading-relaxed bg-sidebar-accent text-sidebar-foreground border border-sidebar-border rounded-bl-none space-y-2">
                    <div className="flex items-center justify-between gap-2 text-sidebar-foreground font-medium text-[11px]">
                      <div className="flex items-center gap-2 truncate">
                        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-primary" />
                        <span className="truncate">{streamingStatus || "AI agent is generating code..."}</span>
                      </div>
                      {onStop && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={onStop}
                          className="h-5 px-1.5 text-[10px] text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0 font-normal"
                          title="Stop generation"
                        >
                          <Square className="w-2.5 h-2.5 mr-1 fill-current" /> Stop
                        </Button>
                      )}
                    </div>
                    {streamingContent && (
                      <pre className="font-mono text-[10px] text-sidebar-foreground bg-sidebar p-2 rounded-md border border-sidebar-border whitespace-pre-wrap line-clamp-8 overflow-hidden">
                        {streamingContent.slice(-400)}
                      </pre>
                    )}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-3 border-t border-sidebar-border bg-sidebar shrink-0 space-y-2">
              <div className="flex flex-col gap-2">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (!streaming && !isAiEditing && prompt.trim()) {
                        onSend();
                      }
                    }
                  }}
                  disabled={isAiEditing || streaming}
                  placeholder={
                    isAiEditing
                      ? "AI agent is editing code... Click Stop to cancel."
                      : `Describe code changes for ${pageName}... (Enter to send)`
                  }
                  rows={3}
                  className="w-full text-xs bg-sidebar-accent border border-sidebar-border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary text-sidebar-foreground placeholder:text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed font-sans"
                />

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {hasCustomCode && onReset && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[11px] text-destructive hover:text-destructive hover:bg-destructive/10 px-2"
                        onClick={onReset}
                        title="Reset to compiler-generated version"
                      >
                        <RefreshCw className="w-3 h-3 mr-1" /> Reset
                      </Button>
                    )}
                    {isAiEditing && onUnlock && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px] text-sidebar-foreground border-sidebar-border hover:bg-sidebar-accent px-2"
                        onClick={onUnlock}
                        title="Force unlock this node if generation is stuck"
                      >
                        <Unlock className="w-3 h-3 mr-1" /> Unlock
                      </Button>
                    )}
                  </div>

                  {streaming || isAiEditing ? (
                    <Button
                      type="button"
                      onClick={onStop}
                      size="sm"
                      variant="destructive"
                      className="h-7 text-xs ml-auto flex items-center gap-1.5 shadow-sm"
                      title="Stop generation"
                    >
                      <Square className="w-3 h-3 fill-current" /> Stop
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={onSend}
                      disabled={!prompt.trim()}
                      size="sm"
                      className="h-7 text-xs bg-primary hover:bg-primary/90 text-primary-foreground ml-auto flex items-center gap-1.5 shadow-sm font-medium"
                    >
                      <Send className="w-3 h-3" /> Update Code
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </Resizable>
    </>
  );
}
