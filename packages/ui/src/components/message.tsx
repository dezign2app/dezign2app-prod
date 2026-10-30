"use client";

import * as React from "react";
import { cn } from "@workspace/ui/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";

export interface MessageProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: "start" | "end";
}

export const Message = React.forwardRef<HTMLDivElement, MessageProps>(
  ({ className, align = "start", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="message"
        data-align={align}
        className={cn(
          "flex w-full flex-col gap-1 py-1",
          align === "end" ? "items-end" : "items-start",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);
Message.displayName = "Message";

export interface MessageContentProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: "start" | "end";
}

export const MessageContent = React.forwardRef<HTMLDivElement, MessageContentProps>(
  ({ className, align, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="message-content"
        className={cn(
          "flex items-start gap-2 max-w-[85%] sm:max-w-[75%]",
          align === "end" ? "flex-row-reverse" : "flex-row",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);
MessageContent.displayName = "MessageContent";

export interface MessageAvatarProps extends React.ComponentProps<typeof Avatar> {
  src?: string;
  fallback?: string;
}

export const MessageAvatar = React.forwardRef<HTMLSpanElement, MessageAvatarProps>(
  ({ className, src, fallback = "AI", ...props }, ref) => {
    return (
      <Avatar
        ref={ref}
        data-slot="message-avatar"
        className={cn("size-7 shrink-0 text-[10px] font-semibold border border-border/40", className)}
        {...props}
      >
        {src && <AvatarImage src={src} alt="Avatar" />}
        <AvatarFallback className="bg-primary/10 text-primary">{fallback}</AvatarFallback>
      </Avatar>
    );
  },
);
MessageAvatar.displayName = "MessageAvatar";

