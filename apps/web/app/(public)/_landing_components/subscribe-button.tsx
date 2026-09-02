"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useSession } from "@/lib/auth-client";
import { useSearchParams, useRouter } from "next/navigation";
import { isElectron, getElectronAPI } from "@/lib/electron";

interface SubscribeButtonProps {
  productId: string;
}

export const SubscribeButton = ({ productId }: SubscribeButtonProps) => {
  const { data: session, isPending } = useSession();
  const isSignedIn = !!session?.user;
  const isLoaded = !isPending;
  const router = useRouter();

  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [hasAutoTriggered, setHasAutoTriggered] = useState(false);

  const handleCheckout = async () => {
    if (loading) return;
    setLoading(true);

    try {
      const response = await fetch("/api/checkout/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          toast.error("Please sign in to continue.");
          if (isElectron()) {
            const webBaseUrl =
              process.env.NEXT_PUBLIC_DESKTOP_AUTH_URL ||
              process.env.NEXT_PUBLIC_APP_URL ||
              "http://localhost:46500";
            const pricingUrl = `${webBaseUrl}/pricing`;
            const api = getElectronAPI();
            if (api?.auth) {
              api.auth.openBrowserLogin(pricingUrl);
              return;
            }
          }
          router.push(`/sign-in?redirect_url=${encodeURIComponent("/pricing?checkout=true")}`);
          return;
        }
        throw new Error("Checkout failed");
      }

      const { checkoutUrl } = await response.json();

      if (checkoutUrl) {
        if (isElectron()) {
          const api = getElectronAPI();
          if (api?.auth) {
            api.auth.openBrowserLogin(checkoutUrl);
            toast.success("Opened checkout in your browser!");
            return;
          }
        }
        window.location.href = checkoutUrl;
      }
    } catch (error) {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const shouldAutoCheckout = searchParams.get("checkout") === "true";
    if (isSignedIn && shouldAutoCheckout && !loading && !hasAutoTriggered) {
      setHasAutoTriggered(true);
      handleCheckout();
    }
  }, [isSignedIn, searchParams, loading, hasAutoTriggered]);

  const buttonStyle = `
    w-full mt-5 py-[13px] rounded-xl text-sm font-semibold transition-all duration-200
    bg-black text-white disabled:opacity-50 disabled:cursor-not-allowed
  `;

  if (!isLoaded) {
    return (
      <button disabled className={buttonStyle}>
        Loading...
      </button>
    );
  }

  if (!isSignedIn) {
    const handleUnauthenticatedClick = () => {
      if (isElectron()) {
        const webBaseUrl =
          process.env.NEXT_PUBLIC_DESKTOP_AUTH_URL ||
          process.env.NEXT_PUBLIC_APP_URL ||
          "http://localhost:46500";
        const pricingUrl = `${webBaseUrl}/pricing`;
        const api = getElectronAPI();
        if (api?.auth) {
          api.auth.openBrowserLogin(pricingUrl);
          return;
        }
      }
      const currentUrl =
        typeof window !== "undefined" ? window.location.href : "/pricing";
      const redirectUrl = currentUrl.includes("?")
        ? `${currentUrl}&checkout=true`
        : `${currentUrl}?checkout=true`;

      router.push(`/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`);
    };

    return (
      <button
        onClick={handleUnauthenticatedClick}
        className={buttonStyle}
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        Get Started
      </button>
    );
  }

  return (
    <button
      onClick={handleCheckout}
      disabled={loading}
      className={buttonStyle}
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {loading ? "Processing..." : "Get Started"}
    </button>
  );
};
