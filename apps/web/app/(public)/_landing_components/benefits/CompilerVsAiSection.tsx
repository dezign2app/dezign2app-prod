"use client";

import React from "react";
import {
  Cpu,
  Sparkles,
  Coins,
  ShieldCheck,
  Clock,
  RefreshCcw,
  Zap,
  Check,
  X,
  ArrowRight,
} from "lucide-react";

export const CompilerVsAiSection: React.FC = () => {
  return (
    <section className="w-full py-24 bg-[#050505] border-t border-zinc-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col items-center">
        {/* Section Header */}
        <div className="flex flex-col items-center text-center gap-3 mb-16 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800 bg-zinc-900/60 text-xs font-mono text-zinc-400">
            <Cpu className="w-3.5 h-3.5 text-zinc-300" />
            <span>ALGORITHMIC COMPILER VS RAW AI PROMPTING</span>
          </div>

          <h2
            style={{ fontFamily: "var(--font-display)" }}
            className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white mt-2"
          >
            Why Deterministic Compilers Beat Token-Hungry AI
          </h2>

          <p className="text-zinc-400 text-sm sm:text-base md:text-lg leading-relaxed max-w-2xl">
            Raw AI assistants repeatedly regenerate entire codebases, burning hundreds of thousands of tokens on boilerplate while introducing silent hallucinations. Dezign2App uses a mathematical AST engine to generate guaranteed production code in milliseconds—at zero token cost.
          </p>
        </div>

        {/* 3 Pillars: Time, Money, Resources */}
        <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {/* Pillar 1: Time */}
          <div className="p-7 rounded-xl border border-zinc-800/90 bg-[#09090b] flex flex-col justify-between hover:border-zinc-700 transition-colors">
            <div>
              <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white mb-5">
                <Clock className="w-5 h-5" />
              </div>
              <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider">
                Time Efficiency
              </span>
              <h3 className="text-lg font-bold text-white mt-1 mb-3">
                Instant Sub-Second Generation
              </h3>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                Skip waiting minutes for LLMs to slowly stream repetitive CRUD files and auth configs. Dezign2App’s topological compiler parses your canvas and builds the complete Turborepo workspace in under 300ms.
              </p>
            </div>
            <div className="pt-6 border-t border-zinc-800/60 mt-6">
              <span className="text-xs font-mono text-zinc-300 font-semibold">
                Result: Save 20+ hours per sprint
              </span>
            </div>
          </div>

          {/* Pillar 2: Money */}
          <div className="p-7 rounded-xl border border-zinc-800/90 bg-[#09090b] flex flex-col justify-between hover:border-zinc-700 transition-colors">
            <div>
              <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white mb-5">
                <Coins className="w-5 h-5" />
              </div>
              <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider">
                Capital Protection
              </span>
              <h3 className="text-lg font-bold text-white mt-1 mb-3">
                Zero Token Burn on Scaffolding
              </h3>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                Raw AI models consume 100k+ tokens every time you ask them to re-wire routes, ORMs, and packages. Our compiler is 100% deterministic code generation—running entirely without consuming LLM API credits.
              </p>
            </div>
            <div className="pt-6 border-t border-zinc-800/60 mt-6">
              <span className="text-xs font-mono text-zinc-300 font-semibold">
                Result: $0 spent on boilerplate tokens
              </span>
            </div>
          </div>

          {/* Pillar 3: Resources */}
          <div className="p-7 rounded-xl border border-zinc-800/90 bg-[#09090b] flex flex-col justify-between hover:border-zinc-700 transition-colors">
            <div>
              <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white mb-5">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider">
                Resource Allocation
              </span>
              <h3 className="text-lg font-bold text-white mt-1 mb-3">
                Invest In Safeguarding The Product
              </h3>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                Instead of burning your team&apos;s budget on fixing AI hallucinations and boilerplate drift, redeploy your capital toward rigorous penetration testing, security hardening, and building proprietary business logic.
              </p>
            </div>
            <div className="pt-6 border-t border-zinc-800/60 mt-6">
              <span className="text-xs font-mono text-zinc-300 font-semibold">
                Result: Hardened, production-grade security
              </span>
            </div>
          </div>
        </div>

        {/* Head-to-Head Comparison Card */}
        <div className="w-full rounded-2xl border border-zinc-800 bg-[#09090c] p-6 sm:p-10 mb-16">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-8 mb-8 border-b border-zinc-800/80 gap-4">
            <div>
              <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider">
                Direct Side-by-Side
              </span>
              <h3 className="text-2xl font-bold text-white mt-1">
                Raw AI Code Prompting vs. Dezign2App Compiler
              </h3>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto px-3 py-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-400">
              <Zap className="w-3.5 h-3.5 text-zinc-300" />
              <span>Deterministic Engineering</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Raw AI Code Generator */}
            <div className="flex flex-col p-6 rounded-xl bg-[#060608] border border-zinc-900">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-zinc-600" />
                  <h4 className="text-base font-semibold text-zinc-300">
                    Raw AI Code Assistants (Cursor / Devin / Claude)
                  </h4>
                </div>
                <span className="text-[11px] font-mono text-zinc-500 uppercase">
                  Stochastic
                </span>
              </div>

              <div className="flex flex-col gap-3.5 text-xs sm:text-sm text-zinc-400">
                <div className="flex items-start gap-3">
                  <X className="w-4 h-4 text-zinc-600 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-zinc-300">Repeated Full Re-Generation:</strong> LLMs rewrite entire files per prompt, consuming 50k–200k tokens per adjustment.
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <X className="w-4 h-4 text-zinc-600 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-zinc-300">Hallucinations &amp; Broken Imports:</strong> Inconsistent types between ORM models, API routes, and frontend hooks.
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <X className="w-4 h-4 text-zinc-600 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-zinc-300">Compounding API Bills:</strong> Development costs escalate rapidly as codebase size expands beyond context limits.
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <X className="w-4 h-4 text-zinc-600 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-zinc-300">Monorepo Blindspots:</strong> LLMs struggle to maintain cross-package synchronization in Turborepo environments.
                  </span>
                </div>
              </div>
            </div>

            {/* Dezign2App Algorithmic Compiler */}
            <div className="flex flex-col p-6 rounded-xl bg-zinc-900/40 border border-zinc-700/80">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-white" />
                  <h4 className="text-base font-semibold text-white">
                    Dezign2App Algorithmic Compiler
                  </h4>
                </div>
                <span className="text-[11px] font-mono text-zinc-300 uppercase">
                  Mathematical AST
                </span>
              </div>

              <div className="flex flex-col gap-3.5 text-xs sm:text-sm text-zinc-300">
                <div className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-white shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-white">Zero Token Cost:</strong> Compiles complete microservice monorepos deterministically in milliseconds without consuming API tokens.
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-white shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-white">100% Contract Parity:</strong> API schemas, Zod validators, and Drizzle models are mathematically guaranteed to match.
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-white shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-white">Capital Preserved for Security:</strong> Reinvest saved token budgets into penetration testing, compliance, and user retention.
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-white shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-white">Full Monorepo Orchestration:</strong> Generates ready-to-run Turborepo workspaces with Docker, Prisma/Drizzle, and Better Auth.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Future AI Synergy Note */}
        <div className="w-full max-w-4xl p-6 rounded-xl border border-zinc-800 bg-[#0a0a0c] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 text-white mt-0.5">
              <Sparkles className="w-4 h-4 text-zinc-300" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white mb-1">
                Coming Soon: AI Architecture Assistant (Intent &rarr; Compiler)
              </h4>
              <p className="text-xs text-zinc-400 leading-relaxed max-w-xl">
                We are introducing AI to express architectural intent (&ldquo;Build an auth service connected to Postgres with rate limiting&rdquo;), but the code will still be generated by our deterministic compiler. You get the ideation speed of AI with zero hallucinations and zero token waste on scaffolding.
              </p>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-1.5 text-xs font-mono text-zinc-300 px-3 py-1.5 rounded border border-zinc-800 bg-zinc-900/50">
            <span>Roadmap Preview</span>
          </div>
        </div>
      </div>
    </section>
  );
};
