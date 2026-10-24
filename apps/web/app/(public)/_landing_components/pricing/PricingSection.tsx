"use client";

import React from "react";
import Link from "next/link";
import Pricing from "../pricing";
import { Check, ArrowRight, ShieldCheck, Zap, Lock } from "lucide-react";

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

        {/* Early Believer / Team Support Card */}
        <div className="w-full max-w-xl rounded-xl border border-zinc-800 bg-[#0e0e11] p-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div>
            <h4 className="text-sm font-semibold text-white">
              Need Custom Stack Support or Team Seats?
            </h4>
            <p className="text-xs text-zinc-400 mt-1">
              Join our Early Believer program for dedicated onboarding, custom node types, and direct architecture reviews.
            </p>
          </div>

          <Link
            href="/early-believer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium transition-colors shrink-0 border border-zinc-700"
          >
            <span>Early Believer Tiers</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
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
