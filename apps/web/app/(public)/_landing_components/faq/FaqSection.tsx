"use client";

import React, { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";

interface FaqItem {
  question: string;
  answer: string;
}

const FAQS: FaqItem[] = [
  {
    question: "What code stack does Dezign2App generate?",
    answer:
      "Dezign2App compiles your visual architecture into a production-grade pnpm monorepo orchestrated by Turborepo. The output includes Next.js 16 (App Router, React 19, Tailwind CSS v4) for the frontend, Node.js/Express or FastAPI microservices, Better Auth for security, Zustand for client state, and pre-configured Docker Compose files for PostgreSQL and Redis.",
  },
  {
    question: "Is there any platform or vendor lock-in?",
    answer:
      "Zero lock-in. All generated code is standard, clean TypeScript adhering to modern conventions. You can download the full project as a ZIP, open it in StackBlitz, or write it directly to your disk, commit it to GitHub, and deploy anywhere (AWS, Vercel, Railway, or your own self-hosted servers).",
  },
  {
    question: "Can I run Dezign2App offline without cloud dependencies?",
    answer:
      "Yes. The native Electron 34 Desktop Studio embeds local PostgreSQL, SQLite, and Redis database runners, along with a native PTY terminal (PowerShell / zsh). You can design, simulate, and compile architectures entirely on your local hardware.",
  },
  {
    question: "How does the LangGraph Studio integrate with the architecture?",
    answer:
      "Dezign2App features a dedicated visual sub-canvas for LangGraph multi-agent workflows. You can wire router branches, conditional edges, tools, and Model Context Protocol (MCP) tool integrations, with real-time SSE token streaming and checkpoint persistence.",
  },
  {
    question: "How does the compiler handle architecture changes and deletions?",
    answer:
      "Dezign2App includes an intelligent cascading impact engine. When a node or endpoint is deleted or modified, the system analyzes affected routes, subscribers, and imports before mutating files, preventing broken references across your monorepo.",
  },
];

export const FaqSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleFaq = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section className="w-full py-20 bg-muted/20 border-t border-border/60">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 flex flex-col items-center">
        {/* Header */}
        <div className="flex flex-col items-center text-center gap-3 mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-muted-foreground border border-border text-xs font-mono font-semibold uppercase tracking-wider">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Frequently Asked Questions</span>
          </div>
          <h2
            style={{ fontFamily: "var(--font-display)" }}
            className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground"
          >
            Technical Details &amp; Architecture
          </h2>
          <p className="text-muted-foreground text-sm max-w-xl">
            Everything you need to know about the compiler, generated code, and desktop studio.
          </p>
        </div>

        {/* FAQ Accordion List */}
        <div className="w-full flex flex-col gap-3">
          {FAQS.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className="rounded-xl border border-border bg-card shadow-xs overflow-hidden transition-all"
              >
                <button
                  onClick={() => toggleFaq(idx)}
                  className="w-full p-4 sm:p-5 flex items-center justify-between text-left gap-4 hover:bg-muted/30 transition-colors"
                >
                  <span className="text-sm sm:text-base font-semibold text-foreground">
                    {faq.question}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-muted-foreground transition-transform duration-200 shrink-0 ${
                      isOpen ? "rotate-180 text-primary" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed border-t border-border/40">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
