"use client";

import React, { useEffect, useState } from "react";
import { isElectron, getElectronAPI } from "@/lib/electron";
import { useSession, signIn } from "@/lib/auth-client";
import { useMutation } from "convex/react";
import { api } from "@workspace/backend/_generated/api";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@workspace/ui/components/card";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Badge } from "@workspace/ui/components/badge";
import { Separator } from "@workspace/ui/components/separator";
import {
  ExternalLink,
  Laptop,
  ShieldCheck,
  Loader2,
  KeyRound,
  Fingerprint,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

export const SignInView = () => {
  const [inDesktop, setInDesktop] = useState(false);
  const [waitingForAuth, setWaitingForAuth] = useState(false);
  const [manualTicket, setManualTicket] = useState("");
  const [isExchanging, setIsExchanging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<"github" | "google" | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect_url") || "/projects";

  const { data: session, isPending: isSessionLoading } = useSession();
  const ensureUser = useMutation(api.users.ensureAuthUser);

  // If already signed in, ensure user record exists and go directly to /projects or redirectUrl
  useEffect(() => {
    if (session?.user) {
      if (session.user.email) {
        const userEmail = session.user.email;
        ensureUser({
          email: userEmail,
          name: session.user.name || userEmail.split("@")[0] || "User",
          authId: session.user.id,
          avatarUrl: session.user.image || undefined,
        }).catch(() => {});
      }
      router.push(redirectUrl);
    }
  }, [session, router, redirectUrl, ensureUser]);

  // Exchange ticket for Better Auth session inside Electron
  const exchangeTicket = async (ticket: string) => {
    if (!ticket) return;
    try {
      setIsExchanging(true);
      setError(null);

      const res = await fetch("/api/auth/desktop/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket: ticket.trim() }),
      });

      const data = await res.json();
      if (res.ok && data.token) {
        // Set cookie / session
        document.cookie = `better-auth.session_token=${data.token}; path=/; max-age=2592000; SameSite=Lax`;
        setWaitingForAuth(false);
        toast.success("Desktop session connected!");
        window.location.href = "/projects";
      } else {
        setError(data.error || "Failed to exchange ticket");
      }
    } catch (err: any) {
      console.error("[desktop-auth] Ticket exchange error:", err);
      setError("Invalid or expired sign-in ticket. Please try again.");
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
        const ticketToUse = data.ticket || data.token;
        if (ticketToUse) {
          await exchangeTicket(ticketToUse);
        }
      });

      return cleanup;
    }
  }, []);

  const handleBrowserLogin = async () => {
    setWaitingForAuth(true);
    setError(null);
    const api = getElectronAPI();
    if (api?.auth) {
      const webBaseUrl =
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:46500";
      const loginUrl = `${webBaseUrl}/sign-in?redirect_url=${encodeURIComponent(
        `${webBaseUrl}/auth/desktop`,
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

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setError(null);

    try {
      const res = await signIn.email({
        email: email.trim(),
        password,
      });

      if (res.error) {
        setError(res.error.message || "Invalid credentials");
      } else {
        toast.success("Signed in successfully!");
        router.push(redirectUrl);
      }
    } catch (err: any) {
      setError(err?.message || "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSocialSignIn = async (provider: "github" | "google") => {
    try {
      setSocialLoading(provider);
      setError(null);
      await signIn.social({
        provider,
        callbackURL: redirectUrl,
      });
    } catch (err: any) {
      toast.error(err?.message || `Failed to sign in with ${provider}`);
      setSocialLoading(null);
    }
  };

  // If running inside Desktop app: Render clean shadcn authentication card with ONLY browser authentication
  if (inDesktop) {
    return (
      <div className="flex w-full items-center justify-center p-4 min-h-[400px]">
        <Card className="w-full max-w-md border-border bg-card text-card-foreground shadow-xl">
          <CardHeader className="text-center pb-4 pt-6">
            <div className="mx-auto mb-2.5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-sm">
              <Laptop className="h-6 w-6" />
            </div>

            <div className="flex justify-center mb-1">
              <Badge variant="secondary" className="gap-1 px-2.5 py-0.5 text-xs font-normal">
                Desktop Workspace
              </Badge>
            </div>

            <CardTitle className="text-2xl font-bold tracking-tight">
              Sign In to Dezign2App
            </CardTitle>
            <CardDescription className="text-muted-foreground text-xs">
              Connect your account to sync system designs, AI workflows, and workspaces.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3 pt-0 pb-6">
            {/* Primary Browser Sign-In */}
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
                  Continue with Web Browser
                  <ExternalLink className="h-4 w-4" />
                </>
              )}
            </Button>

            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive text-center">
                {error}
              </div>
            )}

            {waitingForAuth && !isExchanging && (
              <form
                onSubmit={handleManualSubmit}
                className="w-full p-2.5 rounded-lg border border-border bg-muted/30 flex flex-col gap-2 text-left animate-in fade-in duration-200"
              >
                <label className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <KeyRound className="h-3 w-3 text-primary" /> Paste sign-in code from browser:
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
          </CardContent>
        </Card>
      </div>
    );
  }

  // Standard Web App: Render full modern Shadcn sign-in card
  return (
    <div className="flex w-full items-center justify-center p-4">
      <Card className="w-full max-w-md border-border bg-card text-card-foreground shadow-2xl">
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-2xl font-bold tracking-tight">
            Welcome back
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Sign in to access your system architecture diagrams and cloud canvas
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Social Logins */}
          <div className="grid grid-cols-2 gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleSocialSignIn("github")}
              disabled={loading || !!socialLoading}
              className="w-full gap-2 text-xs font-medium"
            >
              {socialLoading === "github" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
              )}
              GitHub
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleSocialSignIn("google")}
              disabled={loading || !!socialLoading}
              className="w-full gap-2 text-xs font-medium"
            >
              {socialLoading === "google" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              )}
              Google
            </Button>
          </div>

          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center">
              <Separator />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                Or with email
              </span>
            </div>
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handleEmailSignIn} className="space-y-3">
            <div className="space-y-1.5 text-left">
              <Label htmlFor="email" className="text-xs font-medium">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5 text-left">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-medium">
                  Password
                </Label>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-9 text-xs"
              />
            </div>

            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive text-center">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full text-xs font-medium"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex justify-center border-t border-border pt-4 text-xs text-muted-foreground">
          Don't have an account?{" "}
          <Link
            href={`/sign-up${redirectUrl !== "/projects" ? `?redirect_url=${encodeURIComponent(redirectUrl)}` : ""}`}
            className="ml-1 font-medium text-primary hover:underline"
          >
            Sign up
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
};
