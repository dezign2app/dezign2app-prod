"use client";

import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Blockchain04Icon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { Monitor, ArrowRight, Download } from "lucide-react";

const navLinks = [
  { name: "Studio Perspectives", href: "/#studio-views" },
  { name: "Compiler", href: "/#compiler" },
  { name: "Desktop App", href: "/#desktop" },
  { name: "Pricing", href: "/#pricing" },
  { name: "Docs", href: "https://docs.dezign2app.com", external: true },
];

export const Header: React.FC = () => {
  return (
    <header className="h-16 sticky top-0 w-full flex justify-center px-4 lg:px-6 items-center z-50 backdrop-blur-xl border-b border-border/80 bg-background/85 transition-colors">
      <div className="size-full max-w-6xl flex justify-between items-center">
        {/* Logo */}
        <Link href="/" className="flex gap-2.5 items-center group">
          <div className="w-8 h-8 bg-foreground rounded-lg flex items-center justify-center text-background shadow-xs group-hover:scale-105 transition-transform">
            <HugeiconsIcon
              icon={Blockchain04Icon}
              className="size-4.5"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold tracking-tight text-foreground font-mono">
              dezign2app
            </span>
            <span className="hidden sm:inline-block text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
              Beta
            </span>
          </div>
        </Link>

        {/* Nav Links */}
        <nav className="hidden lg:flex items-center gap-6">
          {navLinks.map((link) =>
            link.external ? (
              <a
                key={link.name}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
              >
                {link.name}
              </a>
            ) : (
              <Link
                key={link.name}
                href={link.href}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
              >
                {link.name}
              </Link>
            )
          )}
        </nav>

        {/* Action Buttons */}
        <div className="flex gap-2.5 items-center">
          <a
            href="https://github.com/dezign2app/dezign2app/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border text-foreground hover:bg-muted font-medium transition-colors"
          >
            <Monitor className="w-3.5 h-3.5 text-primary" />
            <span>Desktop</span>
          </a>

          <Link
            href="/sign-in"
            className="text-xs px-3 py-1.5 text-muted-foreground hover:text-foreground transition-colors font-medium"
          >
            Sign in
          </Link>

          <Link
            href="/sign-up"
            className="text-xs px-3.5 py-1.5 rounded-lg bg-foreground text-background hover:opacity-90 transition-all font-medium flex items-center gap-1.5 shadow-xs"
          >
            <span>Launch Studio</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </header>
  );
};
