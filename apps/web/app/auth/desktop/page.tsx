"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { createDesktopSignInToken } from "@/app/(auth)/_components/actions";
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
import { CheckCircle2, Laptop, ExternalLink, Copy, Check } from "lucide-react";

export default function DesktopAuthSuccessPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const [ticket, setTicket] = useState<string | null>(null);
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function generateTicket() {
      if (isSignedIn) {
        try {
          const res = await createDesktopSignInToken();
          if (res?.token) {
            setTicket(res.token);
            const targetUrl = `dezign2app://auth?ticket=${encodeURIComponent(
              res.token
            )}`;
            setDeepLink(targetUrl);

            // Automatically open desktop app
            window.location.href = targetUrl;
          }
        } catch (err) {
          console.error("Failed to create desktop sign in token:", err);
        } finally {
          setLoading(false);
        }
      }
    }

    if (isLoaded) {
      generateTicket();
    }
  }, [isSignedIn, isLoaded]);

  const handleCopy = () => {
    if (!ticket) return;
    navigator.clipboard.writeText(ticket);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
      <Card className="w-full max-w-md border-border bg-card text-card-foreground shadow-lg">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary border border-primary/20">
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
          </div>
          <div className="flex justify-center mb-1">
            <Badge variant="secondary" className="gap-1.5 py-0.5">
              <Laptop className="h-3 w-3" /> D2A Desktop
            </Badge>
          </div>
          <CardTitle className="text-xl font-semibold">
            Authentication Successful
          </CardTitle>
          <CardDescription className="text-muted-foreground text-sm">
            Redirecting your credentials to D2A Desktop...
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-2 text-center text-xs text-muted-foreground">
          <p>
            Your session has been authenticated. You can safely close this browser window once D2A Desktop loads.
          </p>

          {ticket && (
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-left">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-medium text-foreground">
                  Manual Sign-In Code:
                </span>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-500" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" /> Copy Code
                    </>
                  )}
                </button>
              </div>
              <div className="font-mono text-[11px] bg-background/80 p-2 rounded border border-border truncate text-muted-foreground select-all">
                {ticket}
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-2 pt-0">
          {deepLink ? (
            <Button asChild className="w-full">
              <a href={deepLink}>
                Open D2A Desktop <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          ) : (
            <Button disabled className="w-full">
              {loading ? "Generating ticket..." : "Ready"}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
