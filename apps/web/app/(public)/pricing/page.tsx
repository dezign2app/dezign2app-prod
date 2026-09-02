"use client";

import { useEffect, useState } from "react";
import { isElectron, getElectronAPI } from "@/lib/electron";
import { EffortlessSection } from "../_landing_components/features";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@workspace/ui/components/card";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import { Sparkles, ExternalLink, Laptop } from "lucide-react";

export default function PricingPage() {
  const [inDesktop, setInDesktop] = useState(false);

  useEffect(() => {
    setInDesktop(isElectron());
  }, []);

  const handleOpenBrowserPricing = () => {
    const webBaseUrl =
      process.env.NEXT_PUBLIC_DESKTOP_AUTH_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:46500";
    const pricingUrl = `${webBaseUrl}/pricing`;
    const api = getElectronAPI();
    if (api?.auth) {
      api.auth.openBrowserLogin(pricingUrl);
    } else {
      window.open(pricingUrl, "_blank");
    }
  };

  if (inDesktop) {
    return (
      <div className="flex min-h-[80vh] w-full items-center justify-center p-4">
        <Card className="w-full max-w-md border-border bg-card text-card-foreground shadow-2xl">
          <CardHeader className="text-center pb-4 pt-6">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-sm">
              <Sparkles className="h-7 w-7" />
            </div>

            <div className="flex justify-center mb-1.5">
              <Badge variant="secondary" className="gap-1 px-2.5 py-0.5 text-xs font-normal">
                <Laptop className="h-3 w-3" /> Desktop Workspace
              </Badge>
            </div>

            <CardTitle className="text-2xl font-bold tracking-tight">
              Upgrade Subscription
            </CardTitle>
            <CardDescription className="text-muted-foreground text-xs max-w-xs mx-auto">
              Pricing and checkout are managed securely in your web browser.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 pt-0 pb-6">
            <div className="rounded-lg border border-border bg-muted/40 p-3.5 text-xs text-muted-foreground leading-relaxed">
              Complete your subscription in your web browser. Your desktop workspace will automatically unlock immediately upon checkout.
            </div>

            <Button
              onClick={handleOpenBrowserPricing}
              size="lg"
              className="w-full font-medium transition-all gap-2"
            >
              <span>Continue in Web Browser</span>
              <ExternalLink className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <EffortlessSection />;
}

