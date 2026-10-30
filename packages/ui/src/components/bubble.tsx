"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@workspace/ui/lib/utils";

const bubbleVariants = cva(
  "relative rounded-2xl text-xs sm:text-sm transition-colors shadow-2xs break-words",
  {
    variants: {
      align: {
        start: "rounded-tl-xs",
        end: "rounded-tr-xs",
      },
      variant: {
        default: "bg-muted/80 text-foreground border border-border/40",
        muted: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground border border-border/30",
        outline: "bg-background text-foreground border border-border/60",
      },
    },
    compoundVariants: [
      {
        align: "end",
        variant: "muted",
        className: "bg-primary text-primary-foreground shadow-xs",
      },
    ],
    defaultVariants: {
      align: "start",
      variant: "default",
    },
  },
);

export interface BubbleProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof bubbleVariants> {}

export const Bubble = React.forwardRef<HTMLDivElement, BubbleProps>(
  ({ className, align = "start", variant = "default", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="bubble"
        data-align={align}
        data-variant={variant}
        className={cn(bubbleVariants({ align, variant }), className)}
        {...props}
      >
        {children}
      </div>
    );
  },
);
Bubble.displayName = "Bubble";

export interface BubbleContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export const BubbleContent = React.forwardRef<HTMLDivElement, BubbleContentProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="bubble-content"
        className={cn("px-3.5 py-2 leading-relaxed whitespace-pre-wrap break-words", className)}
        {...props}
      >
        {children}
      </div>
    );
  },
);
BubbleContent.displayName = "BubbleContent";

