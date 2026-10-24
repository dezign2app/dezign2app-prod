"use client";

import React from "react";
import { X, Check } from "lucide-react";

export const ComparisonSection: React.FC = () => {
  return (
    <section className="w-full py-20 bg-[#070709] border-t border-zinc-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col items-center">
        {/* Section Header */}
        <div className="flex flex-col items-center text-center gap-3 mb-14 max-w-2xl">
          <span className="text-xs font-mono uppercase tracking-wider text-zinc-500">
            The Speed Advantage
          </span>
          <h2
            style={{ fontFamily: "var(--font-display)" }}
            className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white"
          >
            Why Builders Choose Dezign2App
          </h2>
          <p className="text-zinc-400 text-sm sm:text-base leading-relaxed">
            Stop letting infrastructure plumbing delay your product launch. Focus on what makes your business unique.
          </p>
        </div>

        {/* 2-Column Comparison Grid */}
        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl">
          {/* The Old Way */}
          <div className="p-7 rounded-xl border border-zinc-900 bg-[#0c0c0e] flex flex-col justify-between">
            <div>
              <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider font-semibold">
                The Traditional Way
              </span>
              <h3 className="text-xl font-bold text-zinc-300 mt-2 mb-6">
                Weeks of Boilerplate &amp; High Sprint Costs
              </h3>

              <div className="flex flex-col gap-4 text-xs sm:text-sm text-zinc-400">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-zinc-900 flex items-center justify-center shrink-0 mt-0.5 text-zinc-600">
                    <X className="w-3.5 h-3.5" />
                  </div>
                  <span>4 to 6 weeks setting up monorepo scaffolding, auth routes, and Docker configs.</span>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-zinc-900 flex items-center justify-center shrink-0 mt-0.5 text-zinc-600">
                    <X className="w-3.5 h-3.5" />
                  </div>
                  <span>Fragile database migrations and mismatched API payloads between frontend and backend.</span>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-zinc-900 flex items-center justify-center shrink-0 mt-0.5 text-zinc-600">
                    <X className="w-3.5 h-3.5" />
                  </div>
                  <span>Days spent debugging WebSocket connection brokers and AI streaming loops.</span>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-zinc-900 flex items-center justify-center shrink-0 mt-0.5 text-zinc-600">
                    <X className="w-3.5 h-3.5" />
                  </div>
                  <span>$15,000+ in senior engineering hours burned before building a single core feature.</span>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-zinc-900 text-xs font-mono text-zinc-600">
              Avg. Time to First Production Deploy: 4–8 Weeks
            </div>
          </div>

          {/* With Dezign2App */}
          <div className="p-7 rounded-xl border border-zinc-700/80 bg-[#111114] flex flex-col justify-between shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 px-3 py-1 bg-white text-black font-mono text-[10px] font-bold rounded-bl-lg">
              10x FASTER
            </div>

            <div>
              <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider font-semibold">
                With Dezign2App
              </span>
              <h3 className="text-xl font-bold text-white mt-2 mb-6">
                From Architecture to Production in Minutes
              </h3>

              <div className="flex flex-col gap-4 text-xs sm:text-sm text-zinc-300">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center shrink-0 mt-0.5 text-black">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <span>Visually design your distributed system, services, and databases in an afternoon.</span>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center shrink-0 mt-0.5 text-black">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <span>Automatic type safety: every route, payload, and database column is contract-verified.</span>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center shrink-0 mt-0.5 text-black">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <span>Real-time streaming, WebSockets, and LangGraph AI agents work out of the box.</span>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center shrink-0 mt-0.5 text-black">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <span>100% clean production code you own forever. Download ZIP or push straight to GitHub.</span>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-zinc-800 text-xs font-mono text-emerald-400 flex items-center justify-between">
              <span>Time to Production Monorepo: Minutes</span>
              <span>100+ Hours Saved</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
