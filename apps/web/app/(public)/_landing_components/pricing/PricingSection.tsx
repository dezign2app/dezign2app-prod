"use client";

import React from "react";
import Pricing from "../pricing";
import { Check, ShieldCheck, Zap, Lock } from "lucide-react";

export const PricingSection: React.FC = () => {
  return (
    <section id="pricing" className="w-full py-24 bg-[#050505] border-t border-zinc-900 scroll-mt-14">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col items-center">
        {/* Sales-Driven Header */}
        <div className="flex flex-col items-center text-center gap-3 mb-14 max-w-2xl">
          <span className="text-xs font-mono uppercase tracking-wider text-zinc-500 font-semibold">
            Simple Pricing
          </span>
          <h2
            style={{ fontFamily: "var(--font-display)" }}
            className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white"
          >
            Pays for Itself on Day One.
          </h2>
          <p className="text-zinc-400 text-sm sm:text-base leading-relaxed">
            A single senior development sprint costs over $5,000. Dezign2App saves you weeks of engineering time by generating your production-grade architecture in seconds.
          </p>
        </div>

        {/* Pricing Card Stage */}
        <div className="w-full flex justify-center mb-12">
          <Pricing hideHeader={true} hideToggle={true} />
        </div>

        {/* High-Trust Buyer Guarantees */}
        <div className="flex flex-wrap items-center justify-center gap-8 mt-12 text-xs font-mono text-zinc-500">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-zinc-400" />
            <span>100% Code Ownership</span>
          </div>
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-zinc-400" />
            <span>Zero Vendor Lock-In</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-zinc-400" />
            <span>Cancel Anytime</span>
          </div>
        </div>
      </div>
    </section>
  );
};
