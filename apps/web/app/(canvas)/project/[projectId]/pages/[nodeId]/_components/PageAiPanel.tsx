"use client";

import React, { useState, useRef, useEffect } from "react";
import { Resizable } from "re-resizable";
import { Sparkles, X, ChevronLeft, AlertTriangle, Send, Loader2, RefreshCw, Unlock, Square } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import { useSidebarStore } from "@/lib/stores/sidebarStore";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
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
  onSend: () => void;
  onStop?: () => void;
  onReset?: () => void;
  onUnlock?: () => void;
  hasCustomCode?: boolean;
}

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
  onSend,
  onStop,
  onReset,
  onUnlock,
  hasCustomCode,
}: PageAiPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const aiPanelWidth = useSidebarStore((s) => s.aiPanelWidth);
  const setAiPanelWidth = useSidebarStore((s) => s.setAiPanelWidth);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  return (
    <>
      {/* Sleek Floating Trigger (CSS-only smooth fade & slide) */}
      <button
        type="button"
        onClick={onToggle}
        className={`pointer-events-auto absolute top-3 right-3 z-30 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sidebar/95 backdrop-blur-md border border-sidebar-border shadow-lg text-xs font-semibold text-sidebar-foreground hover:bg-sidebar-accent select-none group transition-all duration-300 ease-in-out ${
          isOpen
            ? "opacity-0 translate-x-4 pointer-events-none scale-95"
            : "opacity-100 translate-x-0 pointer-events-auto scale-100"
        }`}
        title="Open AI Assistant"
      >
        <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground group-hover:-translate-x-0.5 transition-transform" />
        <Sparkles className="w-4 h-4 text-violet-400 group-hover:scale-110 transition-transform" />
        <span className="font-semibold text-[11px]">AI Assistant</span>
      </button>

      {/* Direct Resizable with Left-edge anchoring */}
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
          left: "w-1.5 bg-sidebar-border hover:bg-primary cursor-col-resize transition-colors z-30 hover:w-2",
        }}
        className={`h-full pointer-events-auto shrink-0 flex flex-col bg-sidebar border-l border-sidebar-border shadow-2xl z-20 select-none font-sans overflow-hidden ${
          isResizing
            ? ""
            : "transition-[width,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
        } ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none border-l-0"
        }`}
      >
      {/* Header */}
      <div className="h-10 px-3 border-b border-sidebar-border flex items-center justify-between shrink-0 bg-sidebar-accent/20">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-400" />
          <span className="text-xs font-semibold tracking-wide uppercase text-sidebar-foreground">
            AI Assistant
          </span>
          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-violet-500/10 text-violet-400 border border-violet-500/20">
            Page Editor
          </Badge>
        </div>
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

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs bg-sidebar/50">
        {messages.length === 0 && !streaming && (
          <div className="flex flex-col gap-3 py-2">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Describe what you want to change on <strong className="text-foreground">{pageName}</strong>. The AI will edit the TSX code and sync it in real time.
            </p>

            <div className="space-y-1.5">
              {[
                "Make it a dark modern sidebar layout",
                "Add a hero section with gradient and stats",
                "Convert to a data table with filters & pagination",
                "Add responsive cards with loading skeleton",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setPrompt(suggestion)}
                  className="w-full text-left text-xs px-2.5 py-1.5 rounded-md border border-sidebar-border bg-sidebar-accent/30 hover:bg-sidebar-accent text-muted-foreground hover:text-foreground transition-all"
                >
                  {suggestion}
                </button>
              ))}
            </div>

            {!outputDir && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-400">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  No workspace folder set. Open the terminal below and pick a folder to enable live disk sync and instant HMR preview.
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
                  ? "bg-violet-600/20 text-foreground border border-violet-500/30 rounded-br-none"
                  : "bg-sidebar-accent/60 text-foreground border border-sidebar-border rounded-bl-none"
              }`}
            >
              {msg.content}
            </div>
            <span className="text-[10px] text-muted-foreground/60 px-1">
              {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        ))}

        {(streaming || isAiEditing) && (
          <div className="flex flex-col items-start gap-1">
            <div className="max-w-[95%] w-full px-3 py-2.5 rounded-xl text-xs leading-relaxed bg-sidebar-accent/60 text-foreground border border-sidebar-border rounded-bl-none space-y-2">
              <div className="flex items-center justify-between gap-2 text-violet-400 font-medium text-[11px]">
                <div className="flex items-center gap-2 truncate">
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                  <span className="truncate">{streamingStatus || "AI is generating code..."}</span>
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
                <pre className="font-mono text-[10px] text-emerald-400 bg-background/80 p-2 rounded-md border border-sidebar-border/60 whitespace-pre-wrap line-clamp-8 overflow-hidden">
                  {streamingContent.slice(-400)}
                </pre>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 border-t border-sidebar-border bg-sidebar shrink-0">
        <div className="flex flex-col gap-2">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!streaming && !isAiEditing) {
                  onSend();
                }
              }
            }}
            disabled={isAiEditing || streaming}
            placeholder={
              isAiEditing
                ? "AI is editing... Click Stop to cancel."
                : "Describe changes... (Enter to send, Shift+Enter for newline)"
            }
            rows={3}
            className="w-full text-xs bg-sidebar-accent/30 border border-sidebar-border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 disabled:opacity-50 disabled:cursor-not-allowed"
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
                  className="h-7 text-[11px] text-amber-500 hover:text-amber-600 border-amber-500/30 hover:bg-amber-500/10 px-2"
                  onClick={onUnlock}
                  title="Force unlock this node if generation is stuck"
                >
                  <Unlock className="w-3 h-3 mr-1" /> Unlock Page
                </Button>
              )}
            </div>
            {streaming || isAiEditing ? (
              <Button
                type="button"
                onClick={onStop}
                size="sm"
                variant="destructive"
                className="h-7 text-xs bg-red-600 hover:bg-red-700 text-white font-medium ml-auto flex items-center gap-1.5 shadow-sm"
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
                className="h-7 text-xs bg-violet-600 hover:bg-violet-700 text-white ml-auto flex items-center gap-1.5"
              >
                <Send className="w-3 h-3" /> Send
              </Button>
            )}
          </div>
        </div>
      </div>
    </Resizable>
  </>
);
}
