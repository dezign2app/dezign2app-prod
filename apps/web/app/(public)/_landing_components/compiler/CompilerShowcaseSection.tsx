"use client";

import React, { useState } from "react";
import {
  FolderTree,
  FileCode,
  Download,
  ExternalLink,
  Layers,
  Terminal,
  CheckCircle2,
  Box,
  Cpu,
  FileJson,
  Package,
} from "lucide-react";

interface CodeSnippet {
  id: string;
  filename: string;
  language: string;
  code: string;
}

const SNIPPETS: CodeSnippet[] = [
  {
    id: "route",
    filename: "apps/api/src/routes/users.ts",
    language: "typescript",
    code: `import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { db } from "@workspace/backend/db";

export const userRouter = Router();

// Auto-generated from Dezign2App User Service node contracts
userRouter.get("/me", requireAuth, async (req, res) => {
  const user = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.id, req.session.userId),
  });
  return res.json({ success: true, user });
});`,
  },
  {
    id: "store",
    filename: "apps/web/stores/useAuthStore.ts",
    language: "typescript",
    code: `import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  user: { id: string; email: string; role: string } | null;
  isAuthenticated: boolean;
  setUser: (user: AuthState["user"]) => void;
  logout: () => void;
}

// LangGraph-style single-reducer state store
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      logout: () => set({ user: null, isAuthenticated: false }),
    }),
    { name: "d2a-auth-storage" }
  )
);`,
  },
  {
    id: "docker",
    filename: "docker-compose.yml",
    language: "yaml",
    code: `version: "3.8"
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: dezign2app
      POSTGRES_PASSWORD: dev_password
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  api-service:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    ports:
      - "3001:3001"
    depends_on:
      - postgres
      - redis`,
  },
  {
    id: "schema",
    filename: "packages/backend/schema.sql",
    language: "sql",
    code: `CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(120),
  role VARCHAR(32) DEFAULT 'user' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_users_email ON users(email);`,
  },
];

export const CompilerShowcaseSection: React.FC = () => {
  const [selectedSnippetId, setSelectedSnippetId] = useState<string>("route");
  const activeSnippet = SNIPPETS.find((s) => s.id === selectedSnippetId)!;

  return (
    <section id="compiler" className="w-full py-24 bg-background scroll-mt-14">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col items-center">
        {/* Header */}
        <div className="flex flex-col items-center text-center gap-3 mb-16 max-w-3xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-xs font-mono font-semibold uppercase tracking-wider">
            <span>Automated Monorepo Compiler</span>
          </div>
          <h2
            style={{ fontFamily: "var(--font-display)" }}
            className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-foreground"
          >
            Visual Diagram → Full-Stack Monorepo
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
            Dezign2App doesn&apos;t output throwaway boilerplate snippets. Our compiler synthesizes an entire, production-grade <strong>Turborepo + pnpm workspace</strong> with strict TypeScript contracts, Docker Compose orchestration, and verified route handlers.
          </p>
        </div>

        {/* 2-Column Split Studio Preview */}
        <div className="w-full rounded-2xl border border-border bg-card shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          {/* Left Column: Virtual File Tree */}
          <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-border bg-muted/20 p-4 sm:p-5 flex flex-col justify-between">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-border/80 pb-3">
                <span className="text-xs font-mono font-bold text-foreground flex items-center gap-2">
                  <FolderTree className="w-4 h-4 text-primary" />
                  <span>workspace-monorepo/</span>
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">
                  Turborepo 2.6
                </span>
              </div>

              {/* Tree File List */}
              <div className="flex flex-col gap-1 text-xs font-mono">
                <span className="text-muted-foreground/80 text-[11px] font-semibold uppercase tracking-wider my-1">
                  Apps & Services
                </span>
                <button
                  onClick={() => setSelectedSnippetId("route")}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-all ${
                    selectedSnippetId === "route"
                      ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">apps/api/src/routes/users.ts</span>
                </button>
                <button
                  onClick={() => setSelectedSnippetId("store")}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-all ${
                    selectedSnippetId === "store"
                      ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">apps/web/stores/useAuthStore.ts</span>
                </button>

                <span className="text-muted-foreground/80 text-[11px] font-semibold uppercase tracking-wider my-1 pt-2">
                  Packages & Infrastructure
                </span>
                <button
                  onClick={() => setSelectedSnippetId("schema")}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-all ${
                    selectedSnippetId === "schema"
                      ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">packages/backend/schema.sql</span>
                </button>
                <button
                  onClick={() => setSelectedSnippetId("docker")}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-all ${
                    selectedSnippetId === "docker"
                      ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <Box className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">docker-compose.yml</span>
                </button>
              </div>
            </div>

            {/* Export Capabilities Pill Box */}
            <div className="mt-8 pt-4 border-t border-border/80 flex flex-col gap-2">
              <span className="text-[10px] font-mono text-muted-foreground font-semibold uppercase tracking-wider">
                Instant Export Options
              </span>
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div className="p-2 rounded bg-background border flex items-center gap-1.5 text-foreground font-medium">
                  <Download className="w-3 h-3 text-emerald-500" />
                  <span>ZIP Bundle</span>
                </div>
                <div className="p-2 rounded bg-background border flex items-center gap-1.5 text-foreground font-medium">
                  <ExternalLink className="w-3 h-3 text-blue-500" />
                  <span>StackBlitz</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Code Viewer */}
          <div className="lg:col-span-8 flex flex-col bg-[#0B0E14] text-white">
            {/* Editor Tab Bar */}
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5 bg-black/40 text-xs font-mono">
              <div className="flex items-center gap-2">
                <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-zinc-200 font-medium">{activeSnippet.filename}</span>
              </div>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
                {activeSnippet.language}
              </span>
            </div>

            {/* Code Body */}
            <div className="p-5 font-mono text-xs sm:text-sm leading-relaxed overflow-x-auto min-h-[380px] text-zinc-300">
              <pre>
                <code>{activeSnippet.code}</code>
              </pre>
            </div>

            {/* Editor Footer Status */}
            <div className="px-4 py-2 border-t border-white/10 bg-black/60 flex items-center justify-between text-[11px] font-mono text-zinc-400">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>TypeScript strict: 0 errors</span>
              </div>
              <span>pnpm install --frozen-lockfile</span>
            </div>
          </div>
        </div>

        {/* Value Proposition Highlights */}
        <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 text-left">
          <div className="p-5 rounded-xl border border-border bg-card/60 flex flex-col gap-2">
            <span className="text-primary font-mono text-xs font-bold">01 — Turborepo Monorepo</span>
            <h4 className="text-sm font-semibold text-foreground">Clean Architectural Separation</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Strict isolation between web frontend, backend microservices, shared UI design system, and canonical canvas schemas.
            </p>
          </div>
          <div className="p-5 rounded-xl border border-border bg-card/60 flex flex-col gap-2">
            <span className="text-blue-500 font-mono text-xs font-bold">02 — Smart Deletion & Impact</span>
            <h4 className="text-sm font-semibold text-foreground">Cascading Dependency Intelligence</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              When a node is deleted, Dezign2App analyzes affected endpoints, routes, subscribers, and imports to prevent broken code references.
            </p>
          </div>
          <div className="p-5 rounded-xl border border-border bg-card/60 flex flex-col gap-2">
            <span className="text-emerald-500 font-mono text-xs font-bold">03 — 1-Click Docker Compose</span>
            <h4 className="text-sm font-semibold text-foreground">Zero Configuration Local Setup</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Spin up your entire distributed system locally with pre-configured PostgreSQL, Redis, Kafka, and microservice containers.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
