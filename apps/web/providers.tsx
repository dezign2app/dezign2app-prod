"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import {
  Authenticated,
  ConvexReactClient,
  Unauthenticated,
} from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { shadcn } from "@clerk/themes";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  throw new Error("Missing NEXT_PUBLIC_CONVEX_URL in your .env file");
}

const convex = new ConvexReactClient(convexUrl);

import "@/lib/utils/patchResizeObserver";
import { Toaster } from "@workspace/ui/components/sonner";

// Suppress benign browser ResizeObserver loop notifications from triggering Next.js dev error overlays
if (typeof window !== "undefined") {
  const isResizeObserverError = (msg: unknown) => {
    if (typeof msg !== "string") return false;
    return (
      msg.includes("ResizeObserver loop completed with undelivered notifications") ||
      msg.includes("ResizeObserver loop limit exceeded") ||
      msg.includes("ResizeObserver")
    );
  };

  window.addEventListener(
    "error",
    (e: ErrorEvent) => {
      if (isResizeObserverError(e.message)) {
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    },
    true,
  );

  window.addEventListener(
    "unhandledrejection",
    (e: PromiseRejectionEvent) => {
      const msg = e.reason?.message || String(e.reason);
      if (isResizeObserverError(msg)) {
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    },
    true,
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <ClerkProvider appearance={{ theme: shadcn }}>
        <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
          <NuqsAdapter>
            {children}
            <Toaster />
          </NuqsAdapter>
        </ConvexProviderWithClerk>
      </ClerkProvider>
    </NextThemesProvider>
  );
}

export const AuthenticatedProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return <Authenticated>{children}</Authenticated>;
};
export const UnauthenticatedProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return <Unauthenticated>{children}</Unauthenticated>;
};
