"use client";

import React, { useRef, useEffect } from "react";
import { Send, Loader2, Square } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Textarea } from "@workspace/ui/components/textarea";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Message } from "./types";

interface AiPanelChatViewProps {
  messages: Message[];
  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  streamingStatus: string;
  onSubmit: (e?: React.FormEvent | React.KeyboardEvent, promptOverride?: string) => void;
  onStop: () => void;
}

const STARTER_SUGGESTIONS = [
  "Design an e-commerce backend with auth, products, and checkout",
  "Add a Redis caching layer to the products service",
  "Create an async event pipeline with Kafka and notification worker",
  "Add a PostgreSQL database schema with users and orders",
];

export function AiPanelChatView({
  messages,
  input,
  setInput,
  isLoading,
  streamingStatus,
  onSubmit,
  onStop,
}: AiPanelChatViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingStatus]);

  return (
    <>
      {/* Messages Scroll Area */}
      <div
        className="flex-1 overflow-y-auto p-3 space-y-3 text-xs bg-sidebar"
        ref={scrollRef}
      >
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col gap-3 py-2">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Describe your system architecture requirements or changes. The AI
              will generate microservices, endpoints, databases, and connections in
              real time.
            </p>

            <div className="space-y-1.5">
              {STARTER_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => {
                    setInput(suggestion);
                    onSubmit(undefined, suggestion);
                  }}
                  className="w-full text-left text-xs px-2.5 py-1.5 rounded-md border border-sidebar-border bg-sidebar-accent/50 hover:bg-sidebar-accent text-sidebar-foreground transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex flex-col gap-1 ${
              msg.role === "user" ? "items-end" : "items-start"
            }`}
          >
            <div
              className={`max-w-[90%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-none"
                  : "bg-sidebar-accent text-sidebar-foreground border border-sidebar-border rounded-bl-none"
              }`}
            >
              {msg.role === "assistant" ? (
                <div className="prose prose-xs dark:prose-invert prose-p:leading-relaxed prose-pre:bg-sidebar/80 prose-pre:border prose-pre:border-sidebar-border">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      ol: ({ ...props }) => (
                        <ol
                          className="list-decimal ml-4 space-y-1 my-1"
                          {...props}
                        />
                      ),
                      ul: ({ ...props }) => (
                        <ul
                          className="list-disc ml-4 space-y-1 my-1"
                          {...props}
                        />
                      ),
                      li: ({ ...props }) => (
                        <li className="pl-0.5" {...props} />
                      ),
                      p: ({ ...props }) => (
                        <p className="mb-1.5 last:mb-0" {...props} />
                      ),
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              ) : (
                msg.content
              )}
              {msg.isStreaming && (
                <span className="inline-block w-1.5 h-3.5 ml-1 bg-current animate-pulse align-middle" />
              )}
            </div>
            {msg.timestamp && (
              <span className="text-[10px] text-muted-foreground px-1">
                {msg.timestamp.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
          </div>
        ))}

        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex flex-col items-start gap-1">
            <div className="max-w-[95%] w-full px-3 py-2 rounded-xl text-xs bg-sidebar-accent text-sidebar-foreground border border-sidebar-border rounded-bl-none flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-muted-foreground" />
                <span>{streamingStatus || "AI is designing your system..."}</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onStop}
                className="h-5 px-1.5 text-[10px] text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0 font-normal"
              >
                <Square className="w-2.5 h-2.5 mr-1 fill-current" /> Stop
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-3 border-t border-sidebar-border bg-sidebar shrink-0">
        <form onSubmit={(e) => onSubmit(e)} className="flex flex-col gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmit(e);
              }
            }}
            placeholder="Ask AI to design your system architecture..."
            className="w-full text-xs bg-sidebar-accent border border-sidebar-border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-sidebar-ring text-sidebar-foreground placeholder:text-muted-foreground min-h-[64px]"
            rows={2}
            disabled={isLoading}
          />
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] text-muted-foreground truncate">
              AI can make mistakes. Verify design.
            </div>
            {isLoading ? (
              <Button
                type="button"
                onClick={onStop}
                size="sm"
                variant="destructive"
                className="h-7 text-xs flex items-center gap-1.5 shadow-sm"
                title="Stop generation"
              >
                <Square className="w-3 h-3 fill-current" /> Stop
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={!input.trim()}
                size="sm"
                className="h-7 text-xs bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-1.5"
              >
                <Send className="w-3 h-3" /> Send
              </Button>
            )}
          </div>
        </form>
      </div>
    </>
  );
}
