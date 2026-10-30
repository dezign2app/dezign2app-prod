# dpm — Dezign Package Manager

> **The visual abstraction layer for npm.**
> npm manages code. dpm gives every npm package a visual, syntax-free interface for the Dezign canvas.

---

## What is dpm?

dpm is a package manager that creates a **visual layer on top of npm packages**, built from the ground up to **solve the fundamental breakdown between AI-generated code and human verification**.

### 1. The Machine Dilemma: Why AI Models Fail at Raw Code

Today's AI coding agents (Claude, Cursor, Devin, Copilot) are tasked with generating thousands of lines of raw text syntax from scratch. When LLMs write raw npm package implementations, they consistently hit the same critical walls:

1. **Syntax & Parameter Hallucination**: Models frequently invent non-existent SDK methods, hallucinate config flags, or mix up deprecated methods from older training data (e.g. using obsolete Stripe charge methods in modern APIs).
2. **Boilerplate & Token Exhaustion**: Up to 70% of an agent's context window and compute tokens are burned writing boilerplate — repetitive route handlers, import statements, headers, types, and middleware chains.
3. **Fragile Glue Code**: Code looks syntactically flawless on the surface, but crashes at runtime due to broken async lifecycles, unhandled stream backpressure, or missing signature verifications.
4. **Zero Architectural Validation**: When generating text files in isolation, an AI cannot visually inspect or verify whether an endpoint's output schema actually matches what the database or downstream consumer expects.
5. **Dependency & Import Drift**: Agents constantly emit imports for packages that aren't installed, fail to configure required environment variables, or misalign peer dependency versions.
6. **Unoptimized & Naive Code**: LLMs default to the simplest brute-force code to satisfy a prompt. They generate N+1 database queries, leave out connection pooling, omit cache layers, and create memory leaks in stream listeners. It works functionally, but runs terribly.
7. **The Token Billing Spiral**: When an AI makes a small mistake in a 400-line file, fixing it requires feeding the entire file back into the context window and re-generating it repeatedly. A single feature can burn millions of tokens in recursive self-healing loops, causing AI billing to explode.

### 2. The Human Dilemma: The Verification & Review Bottleneck

Even when an AI agent produces code that compiles, it introduces an unsustainable crisis for human engineers:

1. **Inability to Verify High-Volume Code (Review Fatigue)**: An AI can spit out 5,000 lines of code across 15 files in 10 seconds. No human engineer can realistically read, audit, and verify that volume of code line-by-line. Reviewers inevitably skim, rubber-stamp PRs, and miss silent security holes or edge-case bugs.
2. **The Loss of Mental Model (The Black-Box Codebase)**: When developers write code by hand, they build an internal spatial and architectural map of how the system works. When AI generates the code, the team loses that mental model. The codebase becomes an alien black box.
3. **Debugging Code Nobody Wrote**: When an AI-generated service fails in production at 2 AM, the developer has zero context. They are forced to reverse-engineer thousands of lines of machine-generated boilerplate that no human ever designed with intention.
4. **Architectural Erosion & Spaghetti Drift**: LLMs solve prompt-by-prompt in isolation. They lack systemic architectural discipline. Over multiple AI iterations, codebases suffer from duplicated utilities, conflicting state patterns, and unmaintainable glue code.
5. **The Illusion of Working Software**: AI-written code often passes basic happy-path checks but conceals subtle concurrency bugs, memory leaks, missing idempotency keys, or unauthenticated handles that only surface under real production load.
6. **Cloud & Infrastructure Billing Shock**: Because unoptimized code slips past exhausted reviewers, hidden resource hogs (unbounded database queries, runaway serverless invocations, un-debounced polling, missing Redis caching) run quietly in production until sudden, exponential cloud and database bills arrive as customer traffic scales.

---

### How dpm Solves Both Sides

**dpm replaces probabilistic text generation and unreadable boilerplate with deterministic visual contracts.**

- **For AI Agents:** They no longer generate fragile syntax. Agents manipulate **typed visual nodes** with rigid input/output schemas. If an agent tries to make an invalid connection, the dpm schema engine rejects it immediately, allowing the agent to self-correct in milliseconds.
- **For Human Engineers:** It completely eliminates code-review fatigue. Instead of auditing 5,000 lines of raw boilerplate, a human verifies a **clean visual graph** where node capabilities, data flows, and configurations are instantly self-evident.
- **Battle-Tested, Pre-Optimized Codegen:** Instead of an AI hallucinating naive code, `@dpm/*` packages compile using performance-hardened templates authored by domain experts (built-in connection pooling, zero N+1 queries, automated caching, streaming backpressure handling).
- **Kills the Token & Cloud Billing Explosion:**
  - **Slashes LLM token costs by 95%+:** Agents don't rewrite 500 lines of code in recursive prompt loops. They emit tiny, 10-token graph operations.
  - **Eliminates cloud billing shocks:** Architectural boundaries, caching nodes, rate limits, and connection pools are visually defined and enforced on the canvas before code is ever deployed.

The Dezign compiler then takes the verified graph and deterministically outputs 100% verified, production-ready code.

---

### The npm ➔ dpm Mapping

Every npm package — Express, Stripe, Prisma, LangGraph, Clerk — is a code library. **dpm wraps them with visual contracts** — typed input/output handles, structured property sidebars, and verified codegen rules — making them drag-and-drop primitives on the Dezign canvas:

| npm gives you... | dpm gives you... |
|---|---|
| `import Stripe from 'stripe'` | A **Stripe node** with typed handles: `onPaymentSuccess`, `createCheckout`, `onSubscriptionCancelled` |
| `import { PrismaClient } from '@prisma/client'` | A **Database node** with entity models, migration hooks, and query handles |
| `import express from 'express'` | A **Service node** with route slots, middleware chains, and lifecycle hooks |
| `import { StateGraph } from '@langchain/langgraph'` | An **Agent node** with state channels, tool slots, memory config, and streaming outputs |

```
express        →  @dpm/express
stripe         →  @dpm/stripe
@prisma/client →  @dpm/prisma
@clerk/nextjs  →  @dpm/clerk
better-auth    →  @dpm/better-auth
langchain      →  @dpm/langgraph
```

**dpm does not replace npm.** When you use `@dpm/stripe` on the canvas, the Dezign compiler still runs `npm install stripe` under the hood and generates real production code. dpm is the abstraction layer *above* npm — the same way TypeScript's `@types/*` packages are an abstraction layer above JavaScript.

---

## The DefinitelyTyped Analogy

When TypeScript arrived, JavaScript libraries didn't rewrite themselves. The community created **DefinitelyTyped** — a repository of `@types/*` packages that added type contracts on top of existing JS code:

```
lodash       →  @types/lodash       (type definitions)
express      →  @types/express      (type definitions)
react        →  @types/react        (type definitions)
```

This didn't change how lodash or Express worked. It added a **contract layer** that made them safer, more discoverable, and self-documenting.

**dpm is DefinitelyTyped for the visual canvas era:**

```
express      →  @dpm/express        (visual node definition)
stripe       →  @dpm/stripe         (visual node definition)
prisma       →  @dpm/prisma         (visual node definition)
```

- `@types/*` added **type safety** to JavaScript
- `@dpm/*` adds **visual architecture contracts** to npm packages

Both follow the same model:
- Package authors can ship definitions natively (embed them in the npm package)
- Or the community can create wrapper definitions independently

---

## How It Changes Development

### Without dpm

```
Developer: "Add Stripe billing with subscription management"

AI Agent:
  → Writes 300 lines of TypeScript
  → Misses webhook signature verification
  → Uses deprecated `stripe.charges.create` instead of PaymentIntents
  → Forgets to install `stripe` package
  → Imports from wrong path
  → Takes 15 minutes of debugging to get working
```

### With dpm

```
Developer: "Add Stripe billing with subscription management"

AI Agent:
  → Places @dpm/stripe node on canvas
  → Connects stripe.onPaymentSuccess → database.updateSubscription
  → Canvas validates: schemas match ✓, handles compatible ✓
  → Dezign compiler generates verified production code
  → npm install stripe runs automatically
  → Working in seconds. Zero syntax. Zero hallucination.
```

The agent operates on **visual graph operations** instead of raw text:

```
connect(stripe.onCheckoutCompleted → prisma.updateUserTier)
```

This single graph operation replaces hundreds of lines of hand-written glue code. The dpm contract guarantees schema compatibility. The Dezign compiler emits the correct code for whatever target framework you're using — Next.js, NestJS, Express, FastAPI.

---

## What dpm Packages Define

A dpm package wraps an npm package and exposes:

| Layer | What It Provides |
|---|---|
| **Handles & Ports** | Visual connection points — inputs the node accepts, outputs it emits. Each typed with a schema. |
| **Config Properties** | Structured settings — API keys, modes, options. Shown in the canvas sidebar. No code editing needed. |
| **Port Schemas** | Strict I/O contracts. The canvas rejects invalid connections at design time, not runtime. |
| **Pipeline Steps** | Pre-built middleware and transformers. Validation, auth checks, data mapping — ready to plug in. |
| **Codegen Rules** | How to compile this visual node into production code for each target framework. |

This means:
- An **Express service** becomes a visual container with route handles and middleware slots
- A **Stripe integration** becomes a node with typed webhook events and checkout actions
- A **Prisma database** becomes an entity graph with query handles and migration hooks
- A **LangGraph agent** becomes a node with state channels, tool slots, and streaming outputs

---

## Two Ways to Ship dpm Packages

### 1. Native — Package author includes dpm support

```
stripe/
├── package.json        ← npm package (unchanged)
├── index.js            ← code (unchanged)
└── dezign/
    └── dezign.json     ← dpm visual contract (new)
```

The npm package ships with its own visual definition. Install `stripe` and the Dezign canvas automatically knows how to render it as a node.

### 2. Community Wrapper — Like `@types/*`

```
@dpm/stripe             ← community-maintained visual contract
  wraps: stripe@^14.0.0
```

If an npm package hasn't added native dpm support, the community (or the Dezign team) publishes a wrapper. Just like `@types/express` provides types for Express without Express having to change anything.

---

## Why This Matters

### For Developers

- **Stop writing glue code.** The same webhook → validate → transform → store pipeline you've written 50 times is now a visual pattern you install once.
- **See your architecture.** Glance at the canvas and instantly understand how services, databases, auth, and payments connect. No more tracing through 20 files of imports.
- **Discover capabilities visually.** Browse what a package can do through its handles and ports, not by reading markdown docs.

### For npm Package Authors

- **Your library becomes a visual building block.** Developers and AI agents can adopt your package in seconds, without reading documentation.
- **Self-documenting APIs.** Input handles, output events, and config properties communicate your library's capabilities better than any README.
- **Massively increased adoption surface.** Every Dezign canvas user — human or AI agent — becomes a potential consumer of your package.

### For AI Agents

- **Zero token waste.** Emit compact graph operations instead of generating thousands of lines of boilerplate.
- **No hallucination.** Port schemas enforce valid connections at design time. The agent cannot wire incompatible types.
- **Self-correcting.** If a connection is invalid, the dpm contract returns a structured error. The agent fixes it immediately instead of producing runtime failures.
- **Framework-agnostic.** The agent builds architecture once. The compiler targets Next.js, NestJS, Express, or FastAPI — the agent doesn't need to know framework-specific syntax.

---

## The Registry

dpm packages are published to and resolved from registries:

- **`registry.dezign.dev`** — the default public registry. The npmjs.com of visual packages.
- **Self-hosted registries** — any team can run their own private registry, just like Verdaccio for npm. Private packages resolve locally; public packages proxy through to the default registry.
- **Scoped packages** — `@org/package` namespacing with per-scope registry routing, identical to npm.

---

## Summary

**npm** gave JavaScript a way to share code.
**DefinitelyTyped** gave JavaScript packages type safety.
**dpm** gives npm packages a visual architecture layer — for syntax-free, deterministic, agentic development.

```
Code Era:      Developer writes syntax    →  hopes it works at runtime
Type Era:      Developer writes typed code →  compiler catches type errors
Visual Era:    Developer connects nodes    →  compiler generates verified code
```

dpm is the **visual era's package manager**.

