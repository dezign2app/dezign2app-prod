"use client";

import React from "react";
import {
  Sparkles,
  Trash,
  History,
  Plus,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";

interface AiPanelHeaderProps {
  showHistory: boolean;
  chatsCount?: number;
  hasMessages: boolean;
  isLoading: boolean;
  onBackToChat: () => void;
  onOpenHistory: () => void;
  onNewChat: () => void;
  onClearHistory?: () => void;
  onClose: () => void;
}

export function AiPanelHeader({
  showHistory,
  chatsCount,
  hasMessages,
  isLoading,
  onBackToChat,
  onOpenHistory,
  onNewChat,
  onClearHistory,
  onClose,
}: AiPanelHeaderProps) {
  return (
    <div className="h-10 px-3 border-b border-sidebar-border flex items-center justify-between shrink-0 bg-sidebar-accent/50">
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
                  onClick={onBackToChat}
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
              {chatsCount !== undefined && (
                <Badge
                  variant="secondary"
                  className="text-[9px] px-1.5 py-0 h-4 bg-sidebar-accent text-muted-foreground border border-sidebar-border"
                >
                  {chatsCount}
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
                  onClick={onNewChat}
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
              onClick={onClose}
              title="Collapse AI Panel"
            >
              <Trash className="w-3.5 h-3.5" />
            </Button>
          </div>
        </>
      ) : (
        /* Active Chat Header */
        <>
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-xs font-semibold tracking-wide uppercase text-sidebar-foreground truncate">
              AI Assistant
            </span>
            <Badge
              variant="outline"
              className="text-[9px] px-1.5 py-0 bg-sidebar-accent text-muted-foreground border-sidebar-border shrink-0 font-normal"
            >
              Architecture
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            {/* Conversation History Toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent rounded"
                  onClick={onOpenHistory}
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
                  onClick={onNewChat}
                >
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>New Conversation</TooltipContent>
            </Tooltip>

            {/* Clear Current Chat History */}
            {hasMessages && onClearHistory && !isLoading && (
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

            {/* Collapse Panel Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent rounded"
                  onClick={onClose}
                >
                  <Trash className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Collapse AI Panel</TooltipContent>
            </Tooltip>
          </div>
        </>
      )}
    </div>
  );
}
