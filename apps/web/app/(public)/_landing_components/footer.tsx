"use client";

import React from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { Blockchain04Icon } from "@hugeicons/core-free-icons";

export const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <div className="w-full bg-[#f4f5f7] dark:bg-card/30 flex flex-col items-center pb-16 overflow-hidden border-t border-border/60">
      {/* Footer Section */}
      <footer className="w-full relative flex flex-col items-center pt-14 px-4 md:px-8 z-10">
        {/* Background Watermark Text */}
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[20vw] font-black text-foreground/5 leading-none select-none pointer-events-none whitespace-nowrap z-0 tracking-tighter">
          dezign2app
        </div>

        {/* Footer Card */}
        <div className="relative z-10 w-full max-w-[1050px] bg-card/95 backdrop-blur-xl rounded-[2rem] shadow-sm border border-border p-8 md:p-12">
          {/* Top row */}
          <div className="flex flex-col lg:flex-row justify-between items-start gap-12">
            {/* Brand and Info */}
            <div className="flex flex-col gap-4 max-w-sm">
              <Link href="/" className="flex gap-2.5 items-center group">
                <div className="w-8 h-8 bg-foreground rounded-lg flex items-center justify-center text-background">
                  <HugeiconsIcon icon={Blockchain04Icon} className="size-4.5" />
                </div>
                <span className="text-lg font-bold tracking-tight text-foreground font-mono">
                  dezign2app
                </span>
              </Link>
              <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                Visual system architecture modeling and full-stack monorepo code automation. Model topologies, database ERDs, real-time protocols, and LangGraph agents on an interactive canvas and compile directly into production code.
              </p>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                <span>Support:</span>
                <a
                  href="mailto:founder@dezign2app.com"
                  className="text-foreground hover:underline font-semibold"
                >
                  founder@dezign2app.com
                </a>
              </div>
              {/* Social Links */}
              <div className="flex gap-4 mt-2 text-foreground">
                <a
                  href="https://x.com/hash_aidev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary transition-colors"
                >
                  <span className="sr-only">X (Twitter)</span>
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
                  </svg>
                </a>
                <a
                  href="https://github.com/dezign2app/dezign2app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary transition-colors"
                >
                  <span className="sr-only">GitHub</span>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    viewBox="0 0 24 24"
                  >
                    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
                    <path d="M9 18c-4.51 2-5-2-7-2" />
                  </svg>
                </a>
              </div>
            </div>

            {/* Links Columns */}
            <div className="flex flex-wrap gap-10 md:gap-14">
              <div className="flex flex-col gap-4">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider font-mono">
                  Product
                </h4>
                <div className="flex flex-col gap-2.5">
                  <Link
                    href="/#studio-views"
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Studio Perspectives
                  </Link>
                  <Link
                    href="/#compiler"
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Compiler Engine
                  </Link>
                  <Link
                    href="/#desktop"
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Desktop Studio
                  </Link>
                  <Link
                    href="/#pricing"
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Pricing
                  </Link>
                  <a
                    href="https://github.com/dezign2app/dezign2app/releases"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Desktop Downloads
                  </a>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider font-mono">
                  Resources
                </h4>
                <div className="flex flex-col gap-2.5">
                  <a
                    href="https://docs.dezign2app.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Documentation
                  </a>
                  <Link
                    href="/changelog"
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Changelog
                  </Link>
                  <Link
                    href="/tutorials"
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Tutorials
                  </Link>
                  <Link
                    href="/support"
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Support Center
                  </Link>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider font-mono">
                  Legal
                </h4>
                <div className="flex flex-col gap-2.5">
                  <Link
                    href="/privacy"
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Privacy Policy
                  </Link>
                  <Link
                    href="/terms"
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Terms of Service
                  </Link>
                  <Link
                    href="/aup"
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Acceptable Use
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom row */}
          <div className="mt-12 pt-6 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-muted-foreground">
            <div>&copy; {currentYear} Dezign2App Inc. All rights reserved.</div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              <span>All Systems Operational</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
