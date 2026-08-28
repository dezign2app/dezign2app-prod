"use client";

import React from "react";
import {
  History,
  Plus,
  MessageSquare,
  Search,
  Clock,
  Trash,
  Loader2,
} from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import { formatDistanceToNow } from "date-fns";
import { Id } from "@workspace/backend/_generated/dataModel";

interface AiPanelHistoryProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  chats: Array<{ _id: Id<"project_chats">; title: string; createdAt?: number; _creationTime: number }> | undefined;
  filteredChats: Array<{ _id: Id<"project_chats">; title: string; createdAt?: number; _creationTime: number }>;
  activeChatId: Id<"project_chats"> | null;
  deletingChatId: string | null;
  onSelectChat: (chatId: Id<"project_chats">) => void;
  onDeleteChat: (e: React.MouseEvent, chatId: Id<"project_chats">) => void;
  onNewChat: () => void;
}

export function AiPanelHistory({
  searchQuery,
  setSearchQuery,
  chats,
  filteredChats,
  activeChatId,
  deletingChatId,
  onSelectChat,
  onDeleteChat,
  onNewChat,
}: AiPanelHistoryProps) {
  return (
    <div className="flex-1 flex flex-col min-h-0 bg-sidebar">
      {/* Search Bar */}
      <div className="p-2.5 border-b border-sidebar-border bg-sidebar">
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
      </div>

      {/* Conversations List Scroll Area */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {chats === undefined ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            <span className="text-xs">Loading conversations...</span>
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-52 text-center p-4 text-muted-foreground gap-2.5">
            <div className="w-10 h-10 rounded-full bg-sidebar-accent border border-sidebar-border flex items-center justify-center text-muted-foreground">
              <History className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-sidebar-foreground">
                No conversations found
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {searchQuery
                  ? "Try matching different keywords"
                  : "Start a conversation to design your system architecture"}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-sidebar-border bg-sidebar hover:bg-sidebar-accent text-sidebar-foreground mt-1"
              onClick={onNewChat}
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Start New Conversation
            </Button>
          </div>
        ) : (
          filteredChats.map((conv) => {
            const isActive = conv._id === activeChatId;
            const isDeleting = deletingChatId === conv._id;

            return (
              <div
                key={conv._id}
                onClick={() => onSelectChat(conv._id)}
                className={`group relative flex flex-col gap-1.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                  isActive
                    ? "bg-sidebar-accent border-sidebar-border text-sidebar-foreground shadow-sm"
                    : "bg-sidebar hover:bg-sidebar-accent/50 border-sidebar-border/70 hover:border-sidebar-border text-muted-foreground hover:text-sidebar-foreground"
                }`}
              >
                {/* Top Row: Title + Active Badge + Delete Button */}
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <MessageSquare className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                    <span
                      className={`text-xs truncate ${
                        isActive
                          ? "text-sidebar-foreground font-semibold"
                          : "text-sidebar-foreground"
                      }`}
                    >
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
                      onClick={(e) => onDeleteChat(e, conv._id)}
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

                {/* Bottom Row: Timestamp */}
                <div className="flex items-center justify-between text-[10px] text-muted-foreground pl-5">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <span>
                      {formatDistanceToNow(
                        new Date(conv.createdAt || conv._creationTime),
                        { addSuffix: true },
                      )}
                    </span>
                  </div>
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
          onClick={onNewChat}
          className="w-full h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium flex items-center justify-center gap-1.5 shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" /> Start New Conversation
        </Button>
      </div>
    </div>
  );
}
