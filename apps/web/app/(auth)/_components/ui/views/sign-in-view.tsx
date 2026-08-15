"use client";

import React, { useEffect, useState } from "react";
import { SignIn, useSignIn, useAuth } from "@clerk/nextjs";
import { isElectron, getElectronAPI } from "@/lib/electron";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@workspace/ui/components/card";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import { ExternalLink, Laptop, ShieldCheck, Loader2, KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";

export const SignInView = () => {
  const [inDesktop, setInDesktop] = useState(false);
  const [waitingForAuth, setWaitingForAuth] = useState(false);
  const [manualTicket, setManualTicket] = useState("");
  const [isExchanging, setIsExchanging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { signIn, setActive, isLoaded: isSignInLoaded } = useSignIn();

  // If already signed in, go directly to /projects
  useEffect(() => {
    if (isSignedIn) {
      router.push("/projects");
    }
  }, [isSignedIn, router]);

  // Exchange ticket for Clerk session inside Electron
  const exchangeTicket = async (ticket: string) => {
    if (!signIn || !setActive || !ticket) return;
    try {
      setIsExchanging(true);
      setError(null);
      console.log("[desktop-auth] Exchanging ticket for session...");

      const res = await signIn.create({
        strategy: "ticket",
        ticket: ticket.trim(),
      });

      if (res.status === "complete") {
        await setActive({ session: res.createdSessionId });
        setWaitingForAuth(false);
        router.push("/projects");
      } else {
        console.warn("[desktop-auth] Incomplete sign-in status:", res.status);
      }
    } catch (err: any) {
      console.error("[desktop-auth] Ticket exchange error:", err);
      setError(
        err?.errors?.[0]?.message || "Invalid or expired sign-in ticket. Please try again."
      );
    } finally {
      setIsExchanging(false);
    }
  };

  useEffect(() => {
    setInDesktop(isElectron());

    const api = getElectronAPI();
    if (api?.auth) {
      // Listen for incoming deep link callback from browser
      const cleanup = api.auth.onAuthCallback(async (data) => {
        console.log("[desktop-auth] Deep link callback received:", data);
        const ticketToUse = data.ticket || data.token;
        if (ticketToUse) {
          await exchangeTicket(ticketToUse);
        }
      });

      return cleanup;
    }
  }, [isSignInLoaded, signIn, setActive]);

  const handleBrowserLogin = async () => {
    setWaitingForAuth(true);
    setError(null);
    const api = getElectronAPI();
    if (api?.auth) {
      const webBaseUrl =
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const loginUrl = `${webBaseUrl}/sign-in?redirect_url=${encodeURIComponent(
        `${webBaseUrl}/auth/desktop`
      )}`;
      await api.auth.openBrowserLogin(loginUrl);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualTicket.trim()) {
      exchangeTicket(manualTicket.trim());
    }
  };

  // If running inside Desktop app: Render clean shadcn authentication card
  if (inDesktop) {
    return (
      <div className="flex w-full items-center justify-center p-4 min-h-[500px]">
        <Card className="w-full max-w-md border-border bg-card text-card-foreground shadow-xl">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-sm">
              <Laptop className="h-7 w-7" />
            </div>

            <div className="flex justify-center mb-1.5">
              <Badge variant="secondary" className="gap-1 px-2.5 py-0.5 text-xs font-normal">
                Desktop Workspace
              </Badge>
            </div>

            <CardTitle className="text-2xl font-bold tracking-tight">
              Sign In to Dezign2App
            </CardTitle>
            <CardDescription className="text-muted-foreground text-sm">
              Authenticate via your default web browser to sync your system design diagrams, AI workflows, and cloud storage.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 pt-0">
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-3 text-left">
              <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
              <div className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground block">
                  Secure Browser Sign-In
                </span>
                Supports Google, GitHub, Email, Passkeys & 2FA.
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive text-center">
                {error}
              </div>
            )}
          </CardContent>

          <CardFooter className="flex flex-col gap-3 pt-0">
            <Button
              onClick={handleBrowserLogin}
              size="lg"
              className="w-full font-medium transition-all gap-2"
              disabled={isExchanging}
            >
              {isExchanging ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Connecting Session...
                </>
              ) : waitingForAuth ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Waiting for browser login...
                </>
              ) : (
                <>
                  Continue in Browser
                  <ExternalLink className="h-4 w-4" />
                </>
              )}
            </Button>

            {waitingForAuth && !isExchanging && (
              <form
                onSubmit={handleManualSubmit}
                className="w-full pt-3 border-t border-border mt-1 flex flex-col gap-2 text-left"
              >
                <label className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <KeyRound className="h-3 w-3" /> Or paste sign-in code from browser:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="ticket_..."
                    value={manualTicket}
                    onChange={(e) => setManualTicket(e.target.value)}
                    className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!manualTicket.trim() || isExchanging}
                  >
                    Submit
                  </Button>
                </div>
              </form>
            )}
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Standard Web App: Render regular Clerk component
  return <SignIn routing="hash" />;
};
