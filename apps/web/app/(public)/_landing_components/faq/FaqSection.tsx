"use client";

import React, { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";

interface FaqItem {
  question: string;
  answer: string;
}

const FAQS: FaqItem[] = [
  {
    question: "Is the generated code actually production-ready?",
    answer:
      "Yes. Dezign2App generates clean, standard TypeScript structured as a Turborepo + pnpm monorepo. It includes Next.js 16 App Router for the frontend, typed Express or FastAPI microservices, Better Auth authentication with RBAC guards, and Docker Compose with database migrations. It is the exact architecture senior engineering teams build by hand.",
  },
  {
    question: "Do I own the code, or is there vendor lock-in?",
    answer:
      "You own 100% of the code. There are zero runtime fees, no proprietary SDKs, and zero vendor lock-in. You can download the project as a ZIP, push it to GitHub, and deploy to AWS, GCP, Vercel, Railway, or your own self-hosted servers. Your code is yours forever.",
  },
  {
    question: "How is this different from generic AI chat tools like ChatGPT or Cursor?",
    answer:
      "Generic AI assistants write code line-by-line without understanding your complete distributed architecture, often breaking schema migrations and API contracts. Dezign2App operates at the architecture level: you visually design services, databases, and auth, and the compiler deterministically produces a fully wired monorepo with verified type safety.",
  },
  {
    question: "Can I customize and extend the generated codebase?",
    answer:
      "Yes. The output is a standard TypeScript codebase. You can modify code in our built-in Monaco editor, or open it locally in your favorite editor (VS Code, Cursor, WebStorm). You can add custom packages, tweak UI components, and install any npm package.",
  },
  {
    question: "Can I run Dezign2App offline on my local machine?",
    answer:
      "Yes. With our native Electron 34 Desktop Studio, you get embedded local database runners (PostgreSQL, SQLite, Redis) and an integrated native PTY terminal. You can design, simulate, and compile complete systems offline with zero cloud setup.",
  },
];

export const FaqSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleFaq = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section className="w-full py-24 bg-[#08080a] border-t border-zinc-900">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 flex flex-col items-center">
        {/* Header */}
        <div className="flex flex-col items-center text-center gap-3 mb-12">
          <span className="text-xs font-mono uppercase tracking-wider text-zinc-500 font-semibold">
            Common Questions
          </span>
          <h2
            style={{ fontFamily: "var(--font-display)" }}
            className="text-3xl sm:text-4xl font-bold tracking-tight text-white"
          >
            Frequently Asked Questions
          </h2>
          <p className="text-zinc-400 text-sm max-w-lg">
            Everything you need to know about code ownership, production readiness, and workflow.
          </p>
        </div>

        {/* FAQ Accordion List */}
        <div className="w-full flex flex-col gap-2.5">
          {FAQS.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className="rounded-lg border border-zinc-800 bg-[#0c0c0f] overflow-hidden transition-colors"
              >
                <button
                  onClick={() => toggleFaq(idx)}
                  className="w-full p-4 sm:p-5 flex items-center justify-between text-left gap-4 hover:bg-zinc-900/50 transition-colors"
                >
                  <span className="text-sm font-semibold text-white">
                    {faq.question}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-zinc-400 transition-transform duration-200 shrink-0 ${
                      isOpen ? "rotate-180 text-white" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-0 text-xs sm:text-sm text-zinc-400 leading-relaxed border-t border-zinc-850">
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
