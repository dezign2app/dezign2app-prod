"use client";

import React from "react";
import Link from "next/link";
import Pricing from "../pricing";
import { CheckCircle2, ShieldCheck, Sparkles, ArrowRight, HeartHandshake } from "lucide-react";

export const PricingSection: React.FC = () => {
  return (
    <section id="pricing" className="w-full py-24 bg-background scroll-mt-14">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col items-center">
        {/* Header */}
        <div className="flex flex-col items-center text-center gap-3 mb-12 max-w-3xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-mono font-semibold uppercase tracking-wider">
            <span>Simple, Transparent Pricing</span>
          </div>
          <h2
            style={{ fontFamily: "var(--font-display)" }}
            className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-foreground"
          >
            Start Building with Dezign2App Beta
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
            Get instant access to the visual multi-canvas studio, full-stack monorepo compiler, native Electron desktop app, and real-time architecture simulation.
          </p>
        </div>

        {/* Pricing Card Stage */}
        <div className="w-full flex justify-center mb-12">
          <Pricing hideHeader={true} hideToggle={true} />
        </div>

        {/* Early Believer & Custom Stack Banner */}
        <div className="w-full max-w-3xl rounded-2xl border border-border bg-card p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">
                Looking for Team Seats or Custom Stack Support?
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Join our Early Believer program for prioritized custom node types and direct architecture reviews with our founders.
              </p>
            </div>
          </div>

          <Link
            href="/early-believer"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-muted text-foreground text-xs font-medium hover:bg-muted/80 transition-colors shrink-0 border border-border"
          >
            <span>Early Believer Tiers</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Developer Guarantees */}
        <div className="flex flex-wrap items-center justify-center gap-6 mt-12 text-xs font-mono text-muted-foreground">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>100% Code Ownership — Zero Lock-In</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Instant Turborepo &amp; Docker Output</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Runs Completely Offline on Desktop</span>
          </div>
        </div>
      </div>
    </section>
  );
};
