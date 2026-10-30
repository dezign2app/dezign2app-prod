"use client";

import * as React from "react";
import { ArrowDown } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";

interface MessageScrollerContextValue {
  isAtBottom: boolean;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  autoScroll: boolean;
  setAutoScroll: (autoScroll: boolean) => void;
  viewportRef: React.RefObject<HTMLDivElement | null>;
  registerAnchor: (messageId: string, node: HTMLElement | null) => void;
}

const MessageScrollerContext = React.createContext<MessageScrollerContextValue | null>(null);

export function useMessageScroller(): MessageScrollerContextValue {
  const context = React.useContext(MessageScrollerContext);
  if (!context) {
    throw new Error("useMessageScroller must be used within a MessageScrollerProvider");
  }
  return context;
}

export interface MessageScrollerProviderProps {
  autoScroll?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function MessageScrollerProvider({
  autoScroll: initialAutoScroll = true,
  children,
}: MessageScrollerProviderProps) {
  const [autoScroll, setAutoScroll] = React.useState(initialAutoScroll);
  const [isAtBottom, setIsAtBottom] = React.useState(true);
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const anchorsRef = React.useRef<Map<string, HTMLElement>>(new Map());

  const scrollToBottom = React.useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = viewportRef.current;
    if (el) {
      el.scrollTo({
        top: el.scrollHeight,
        behavior,
      });
      setIsAtBottom(true);
    }
  }, []);

  const registerAnchor = React.useCallback((messageId: string, node: HTMLElement | null) => {
    if (node) {
      anchorsRef.current.set(messageId, node);
    } else {
      anchorsRef.current.delete(messageId);
    }
  }, []);

  const contextValue = React.useMemo<MessageScrollerContextValue>(
    () => ({
      isAtBottom,
      scrollToBottom,
      autoScroll,
      setAutoScroll,
      viewportRef,
      registerAnchor,
    }),
    [isAtBottom, scrollToBottom, autoScroll, registerAnchor],
  );

  return (
    <MessageScrollerContext.Provider value={contextValue}>
      {children}
    </MessageScrollerContext.Provider>
  );
}

export interface MessageScrollerProps extends React.HTMLAttributes<HTMLDivElement> {}

export const MessageScroller = React.forwardRef<HTMLDivElement, MessageScrollerProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="message-scroller"
        className={cn("relative flex flex-col w-full h-full min-h-0 overflow-hidden", className)}
        {...props}
      >
        {children}
      </div>
    );
  },
);
MessageScroller.displayName = "MessageScroller";

export interface MessageScrollerViewportProps extends React.HTMLAttributes<HTMLDivElement> {}

export const MessageScrollerViewport = React.forwardRef<HTMLDivElement, MessageScrollerViewportProps>(
  ({ className, children, onScroll, ...props }, ref) => {
    const { viewportRef, autoScroll, scrollToBottom } = useMessageScroller();
    const internalRef = React.useRef<HTMLDivElement | null>(null);

    React.useImperativeHandle<HTMLDivElement | null, HTMLDivElement | null>(
      ref,
      () => internalRef.current,
    );

    const checkIsAtBottom = React.useCallback(() => {
      const el = internalRef.current;
      if (!el) return true;
      const threshold = 32;
      return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
    }, []);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
      onScroll?.(e);
      const atBottom = checkIsAtBottom();
      const ctx = viewportRef.current;
      if (ctx) {
        // internal update
      }
    };

    // Auto-scroll on content updates when at bottom
    React.useEffect(() => {
      const el = internalRef.current;
      if (!el) return;

      const observer = new MutationObserver(() => {
        if (autoScroll && checkIsAtBottom()) {
          scrollToBottom("smooth");
        }
      });

      observer.observe(el, { childList: true, subtree: true, characterData: true });
      return () => observer.disconnect();
    }, [autoScroll, checkIsAtBottom, scrollToBottom]);

    return (
      <div
        ref={(node) => {
          internalRef.current = node;
          (viewportRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }}
        data-slot="message-scroller-viewport"
        onScroll={handleScroll}
        className={cn("flex-1 w-full overflow-y-auto overflow-x-hidden min-h-0 scroll-smooth", className)}
        {...props}
      >
        {children}
      </div>
    );
  },
);
MessageScrollerViewport.displayName = "MessageScrollerViewport";

export interface MessageScrollerContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export const MessageScrollerContent = React.forwardRef<HTMLDivElement, MessageScrollerContentProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="message-scroller-content"
        className={cn("flex flex-col gap-3 p-4", className)}
        {...props}
      >
        {children}
      </div>
    );
  },
);
MessageScrollerContent.displayName = "MessageScrollerContent";

export interface MessageScrollerItemProps extends React.HTMLAttributes<HTMLDivElement> {
  messageId?: string;
  scrollAnchor?: boolean;
}

export const MessageScrollerItem = React.forwardRef<HTMLDivElement, MessageScrollerItemProps>(
  ({ className, messageId, scrollAnchor, children, ...props }, ref) => {
    const { registerAnchor } = useMessageScroller();
    const itemRef = React.useRef<HTMLDivElement | null>(null);

    React.useEffect(() => {
      if (scrollAnchor && messageId && itemRef.current) {
        registerAnchor(messageId, itemRef.current);
      }
      return () => {
        if (messageId) {
          registerAnchor(messageId, null);
        }
      };
    }, [scrollAnchor, messageId, registerAnchor]);

    return (
      <div
        ref={(node) => {
          itemRef.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }}
        data-slot="message-scroller-item"
        data-message-id={messageId}
        data-scroll-anchor={scrollAnchor ? "true" : undefined}
        className={cn("w-full", className)}
        {...props}
      >
        {children}
      </div>
    );
  },
);
MessageScrollerItem.displayName = "MessageScrollerItem";

export interface MessageScrollerButtonProps
  extends Omit<React.ComponentProps<typeof Button>, "onClick"> {
  className?: string;
}

export function MessageScrollerButton({
  className,
  size = "icon",
  variant = "outline",
  ...props
}: MessageScrollerButtonProps) {
  const { isAtBottom, scrollToBottom } = useMessageScroller();

  if (isAtBottom) {
    return null;
  }

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      onClick={() => scrollToBottom("smooth")}
      className={cn(
        "absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full shadow-md bg-background/90 hover:bg-muted backdrop-blur-xs border border-border/60 transition-all z-20 size-8",
        className,
      )}
      aria-label="Scroll to bottom"
      {...props}
    >
      <ArrowDown className="size-4 text-foreground" />
    </Button>
  );
}

