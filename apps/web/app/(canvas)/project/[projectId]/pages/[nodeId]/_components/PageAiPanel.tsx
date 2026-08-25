"use client";

import React, { useRef, useEffect } from "react";
import { Resizable } from "re-resizable";
import { Sparkles, X, ChevronLeft, AlertTriangle, Send, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";

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
  isAiEditing: boolean;
  outputDir: string;
  pageName: string;
  onSend: () => void;
  onReset?: () => void;
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
  isAiEditing,
  outputDir,
  pageName,
  onSend,
  onReset,
  hasCustomCode,
}: PageAiPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="pointer-events-auto absolute top-3 right-3 z-30 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sidebar/95 backdrop-blur-md border border-sidebar-border shadow-lg text-xs font-semibold text-sidebar-foreground hover:bg-sidebar-accent transition-all select-none group"
        title="Open AI Assistant"
      >
        <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground group-hover:-translate-x-0.5 transition-transform" />
        <Sparkles className="w-4 h-4 text-violet-400 group-hover:scale-110 transition-transform" />
        <span className="font-semibold text-[11px]">AI Assistant</span>
      </button>
    );
  }

  return (
    <Resizable
      defaultSize={{ width: 340, height: "100%" }}
      minWidth={280}
      maxWidth={600}
      enable={{ left: true }}
      handleClasses={{
        left: "w-1 bg-sidebar-border hover:bg-primary cursor-col-resize transition-colors z-30",
      }}
      className="pointer-events-auto h-full bg-sidebar border-l border-sidebar-border shadow-2xl flex flex-col shrink-0 overflow-hidden select-none font-sans z-20"
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
            <div className="max-w-[90%] px-3 py-2 rounded-xl text-xs leading-relaxed bg-sidebar-accent/60 text-foreground border border-sidebar-border rounded-bl-none">
              {streamingContent ? (
                <pre className="font-mono text-[10px] text-emerald-400 whitespace-pre-wrap line-clamp-8">
                  {streamingContent.slice(-400)}
                </pre>
              ) : (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Loader2 className="w-3 h-3 text-violet-400 animate-spin" />
                  AI is generating code...
                </span>
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
                onSend();
              }
            }}
            disabled={isAiEditing || streaming}
            placeholder={
              isAiEditing
                ? "AI is editing..."
                : "Describe changes... (Enter to send, Shift+Enter for newline)"
            }
            rows={3}
            className="w-full text-xs bg-sidebar-accent/30 border border-sidebar-border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <div className="flex items-center justify-between gap-2">
            {hasCustomCode && onReset ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[11px] text-destructive hover:text-destructive hover:bg-destructive/10 px-2"
                onClick={onReset}
                title="Reset to compiler-generated version"
              >
                <RefreshCw className="w-3 h-3 mr-1" /> Reset
              </Button>
            ) : <div />}
            <Button
              onClick={onSend}
              disabled={!prompt.trim() || isAiEditing || streaming}
              size="sm"
              className="h-7 text-xs bg-violet-600 hover:bg-violet-700 text-white ml-auto"
            >
              {streaming || isAiEditing ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Editing...
                </>
              ) : (
                <>
                  <Send className="w-3 h-3 mr-1" /> Send
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </Resizable>
  );
}
