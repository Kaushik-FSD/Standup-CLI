# StandupBot

> A developer-first CLI tool for logging daily work, tracking blockers, and generating AI-powered standup summaries — built on a production-grade Fastify backend with Redis caching, API key auth, and a pluggable AI provider layer.

[![Node.js](https://img.shields.io/badge/Node.js-v20+-green)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://typescriptlang.org)
[![Fastify](https://img.shields.io/badge/Fastify-5.x-black)](https://fastify.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue)](https://postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-7-red)](https://redis.io)
[![Prisma](https://img.shields.io/badge/Prisma-7.x-white)](https://prisma.io)

---

## What is StandupBot?

StandupBot is a monorepo CLI tool that replaces the mental overhead of writing daily standups. Instead of trying to remember what you did at the end of the day, you log work as you go — and when standup time arrives, the AI generates a clean, professional summary from your logs.

It ships as two packages: a **Fastify backend** that handles persistence, auth, caching, and AI generation, and a **CLI** that talks to the server over HTTP so you can run `standup log "fixed the auth bug"` from anywhere in your terminal.

---

## What Problem It Solves

Developers writing standups daily face the same friction:

- **"What did I actually do today?"** — Memory fades fast. By 5pm you've forgotten what you fixed at 10am.
- **"I have to write this in a consistent format every day"** — Same three sections, every day, manually.
- **"My standup is either too long or too vague"** — Hard to calibrate without a structured log.

StandupBot solves this by separating the *logging* (done in real-time, frictionless) from the *summarizing* (done by AI, on demand). Log as you work, generate when you need it.

---

## 🏗 High-Level Architecture

StandupBot is a **monorepo** with two packages — a Fastify API server and a Commander.js CLI. The CLI talks to the server over HTTP using an API key stored in a local config file. The server handles all persistence, caching, and AI generation.

### Core Philosophy

1. **Log in real-time, generate on demand.** The CLI is designed to be fast — `standup log "message"` should feel like running `git commit`. Generation is a separate step that happens when you actually need it.

2. **Cache aggressively, invalidate precisely.** Today's logs are cached in Redis on first fetch and invalidated on every write. The generate endpoint is rate-limited per user per day via Redis counters — no database overhead on every request.

3. **AI provider as a swappable dependency.** The AI layer sits behind an interface. Swapping from Gemini to Claude is one environment variable change — no route or business logic changes needed.

```
Developer Terminal
        │
        ▼
┌─────────────────────────────────────────────────────┐
│                  Commander.js CLI                   │
│                                                     │
│   standup init    standup log    standup history    │
│   standup delete  standup generate  standup weekly  │
│                                                     │
│   config.ts → ~/.standup-cli/config.json            │
│   http.ts   → axios with x-api-key header           │
└──────────────────────┬──────────────────────────────┘
                       │  HTTP (localhost:9001)
                       ▼
┌─────────────────────────────────────────────────────┐
│                  Fastify API Server                 │
│                                                     │
│   Auth Plugin (onRequest hook)   Rate Limiter       │
│   (x-api-key → Redis → DB)       (Redis counters)   │
│                                                     │
│   /api/auth/init   /api/logs   /api/generate        │
│                    /api/logs/:id  /api/generate/weekly │
└──────────────┬──────────────────────┬───────────────┘
               │                      │
    ┌──────────▼──────────┐  ┌────────▼───────────────┐
    │     PostgreSQL      │  │        Redis            │
    │                     │  │                         │
    │  User               │  │  apikey:<key>           │
    │  LogEntry           │  │  logs:<userId>:today    │
    │  GeneratedSummary   │  │  ratelimit:generate:<id>│
    └─────────────────────┘  └─────────────────────────┘
                                        │
                             ┌──────────▼──────────────┐
                             │     AI Provider Layer   │
                             │                         │
                             │  GeminiProvider         │
                             │  ClaudeProvider         │
                             │  MockProvider           │
                             └─────────────────────────┘
```

---

## 🚀 Key Technical Deep Dives

### 1. API Key Auth with Redis Cache

Every request (except `/api/auth/init` and `/health`) passes through a global `onRequest` hook that validates the `x-api-key` header.

The auth flow uses a **cache-aside pattern**:

```
Incoming request with x-api-key header
        │
        ├── Redis GET apikey:<key>
        │       │
        │       ├── Hit  → attach userId to request → continue ✓
        │       │
        │       └── Miss → DB lookup (findUnique by apiKey)
        │                       │
        │                       ├── Not found → 401 Unauthorized
        │                       │
        │                       └── Found → Redis SET apikey:<key> userId (TTL: 5min)
        │                                 → attach userId to request → continue ✓
```

The `userId` is stored as the Redis value — so a cache hit skips the DB entirely and the route handler gets `request.userId` without any extra lookup. **Every authenticated route gets the user's identity for free.**

### 2. Redis Cache Layer for Logs

`GET /api/logs` fetches today's logs from a Redis cache, not the database, on repeat calls. The cache key is scoped per user and per day: `logs:<userId>:today`.

```
GET /api/logs
        │
        ├── Redis GET logs:<userId>:today
        │       │
        │       ├── Hit  → return parsed JSON ✓
        │       │
        │       └── Miss → Prisma query (today's date range in UTC)
        │                → Redis SET with TTL = seconds until midnight UTC
        │                → return logs ✓

POST /api/logs  →  create in DB  →  Redis DEL logs:<userId>:today
DELETE /api/logs/:id  →  delete from DB  →  Redis DEL logs:<userId>:today
```

**Why invalidate instead of update?** Updating the cache means duplicating the DB query logic in two places — easy to drift. Deleting forces the next GET to re-fetch and rebuild from the source of truth. One place where query logic lives.

### 3. AI Provider Abstraction Layer

The AI layer sits behind a single interface so the underlying provider is swappable without touching any route or business logic:

```typescript
export interface AIProvider {
  generate(prompt: string): Promise<string>;
}
```

Three providers implement this interface — `GeminiProvider`, `ClaudeProvider`, and `MockProvider` (for development without burning API quota). A factory function reads `AI_PROVIDER` from the environment and returns the correct implementation:

```
AI_PROVIDER=gemini  → GeminiProvider  (Gemini 2.0 Flash)
AI_PROVIDER=claude  → ClaudeProvider  (Claude Haiku)
AI_PROVIDER=mock    → MockProvider    (static response, no API call)
```

Switching providers in production is one environment variable change. No code changes required.

### 4. Rate Limiting on Generate via Redis

AI generation is expensive. Each user is limited to 10 generate requests per UTC day, enforced with a Redis counter:

```
Key:   ratelimit:generate:<userId>     e.g. ratelimit:generate:uuid-123
Value: <request count>                 e.g. 3
TTL:   seconds until midnight UTC      auto-resets every day
```

On the first request of the day, `INCR` sets the counter to 1 and `EXPIRE` is set to the remaining seconds until midnight UTC. Every subsequent request increments the counter. At 11 requests, the endpoint returns a 429 with a clear message. At midnight, the key expires and the counter resets automatically — no cron job, no cleanup needed.

### 5. Monorepo with npm Workspaces

Both packages — `@standup-cli/server` and `standup-cli` — live in the same repository and share a root `node_modules` via npm workspaces. Commands can be scoped to a single package:

```bash
npm run dev --workspace=packages/server
npm run build --workspace=packages/cli
```

The CLI is installed globally via `npm link` during development, so `standup` works as a real terminal command pointing at the local build.

---

## 🛠 Tech Stack

| Technology | Role | Why |
|---|---|---|
| **Fastify** | HTTP Framework | Faster than Express, plugin architecture, built-in structured logging with Pino |
| **TypeScript** | Language | End-to-end type safety, Prisma-generated types, Fastify request augmentation |
| **PostgreSQL** | Primary Database | ACID compliance, reliable relational model for user and log data |
| **Prisma 7** | ORM | Type-safe queries, automated migrations, `@prisma/adapter-pg` for Node.js driver |
| **Redis** | Cache + Rate Limiter | O(1) auth cache lookups, log cache with TTL, counter-based rate limiting |
| **Commander.js** | CLI Framework | Declarative command and option definitions, argument parsing |
| **Axios** | HTTP Client | Pre-configured instance with base URL and auth headers baked in |
| **Docker** | Containerization | Reproducible local environment, production parity for PostgreSQL and Redis |
| **Pino** | Logging | Structured JSON logs, built into Fastify, near-zero performance overhead |
| **Gemini / Claude** | AI Layer | Pluggable provider for daily and weekly standup summary generation |

---

## 🏃 Setup & Installation

### Prerequisites

- Node.js v20+
- Docker Desktop
- npm

### 1. Clone the repository

```bash
git clone https://github.com/Kaushik-FSD/StandupBot.git
cd StandupBot
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cd packages/server
cp .env.example .env
```

Open `.env` and fill in your values:

```env
PORT=9001
NODE_ENV=development

DATABASE_URL=postgresql://postgres:password@localhost:5432/standupbot

REDIS_URL=redis://localhost:6379

AI_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key_here

# Optional — swap provider to Claude
# AI_PROVIDER=claude
# ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

### 4. Start infrastructure containers

```bash
docker-compose up -d
```

Verify both containers are running:

```bash
docker ps
# Should show: standupbot-postgres (5432) and standupbot-redis (6379)
```

### 5. Run database migrations

```bash
cd packages/server
npx prisma migrate dev --name init
```

### 6. Generate Prisma client

```bash
npx prisma generate
```

### 7. Start the development server

```bash
npm run dev --workspace=packages/server
```

Server starts at `http://localhost:9001`

### 8. Build and link the CLI globally

```bash
npm run build --workspace=packages/cli
npm link --workspace=packages/cli
```

After linking, `standup` is available as a terminal command from anywhere.

---

## 💻 CLI Usage

### Initialize — create your account and save credentials locally

```bash
standup init --name "Your Name"
# ✅ Initialized as Your Name
# 🔑 Your API key: sb_abc123...
# Saved to ~/.standup-cli/config.json
```

### Log — add a work entry

```bash
standup log "implemented Redis cache layer"
standup log "blocked on DB connection pooling config" --blocker
# ✅ Log added — "implemented Redis cache layer"
```

### History — view today's logs

```bash
standup history
# 📋 Today's standup logs:
#   1. implemented Redis cache layer
#      id: abc-123
#   2. blocked on DB connection pooling config 🚨 [BLOCKER]
#      id: def-456
```

### Generate — AI standup summary for today

```bash
standup generate
# 🤖 AI Standup Summary
#
# What I did today:
# - Implemented Redis cache layer for logs endpoint...
```

### Weekly — AI summary for the whole week

```bash
standup weekly
# 🤖 AI Weekly Summary
#
# Key accomplishments this week:
# - Completed auth module with API key validation...
```

### Delete — remove a log entry

```bash
standup delete <log-id>
# ✅ Log abc-123 deleted
```

---

## 🔒 Security

**API Key Authentication**
- Keys generated with Node.js `crypto.randomBytes(32)` — cryptographically secure
- Prefixed with `sb_` for instant identification
- Validated on every request via Redis cache with 5-minute TTL, falling back to DB
- Key stored in `~/.standup-cli/config.json` locally — never sent anywhere except the `x-api-key` header

**Authorization**
- Every log operation checks that the `userId` on the log matches the authenticated user's ID
- Users cannot read, modify, or delete another user's logs — enforced at the service layer, not just the route layer

**Rate Limiting**
- Generate endpoints limited to 10 requests per user per UTC day
- Enforced via Redis counters with automatic midnight reset — no cron job needed

---

## 🗺 Production Roadmap

**Security**
- [ ] Hash API keys at rest — store SHA-256 hash in DB, never the raw key
- [ ] API key expiry and rotation support

**Features**
- [ ] `standup history --date 2026-03-20` — view logs for a specific past date
- [ ] `standup history --week` — view all logs for the current week
- [ ] Save generated summaries to `GeneratedSummary` table for history

**Infrastructure**
- [ ] Input validation with Zod on all request bodies
- [ ] CI/CD pipeline with GitHub Actions
- [ ] Cloud deployment — containerized with managed secrets

**AI**
- [ ] Tone customization — casual, formal, bullet-only
- [ ] Slack integration — post generated summary directly to a channel

---

## 📁 Project Structure

```
StandupBot/
├── packages/
│   ├── server/
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/           # POST /api/auth/init — user creation, API key generation
│   │   │   │   ├── logs/           # CRUD for log entries with Redis cache layer
│   │   │   │   └── generate/       # AI summary generation with rate limiting
│   │   │   ├── plugins/
│   │   │   │   └── auth.ts         # Global onRequest hook — API key validation
│   │   │   ├── lib/
│   │   │   │   ├── prisma.ts       # Prisma client singleton with PG adapter
│   │   │   │   ├── redis.ts        # ioredis client singleton with reconnect strategy
│   │   │   │   ├── rate-limiter.ts # Redis counter-based rate limiting
│   │   │   │   └── ai/
│   │   │   │       ├── types.ts            # AIProvider interface
│   │   │   │       ├── gemini.provider.ts  # Gemini 2.0 Flash implementation
│   │   │   │       ├── claude.provider.ts  # Claude Haiku implementation
│   │   │   │       ├── mock.provider.ts    # Static mock for development
│   │   │   │       ├── prompt.builder.ts   # Daily and weekly prompt templates
│   │   │   │       └── index.ts            # Provider factory — reads AI_PROVIDER env var
│   │   │   ├── types/
│   │   │   │   └── fastify.d.ts    # FastifyRequest augmentation (userId)
│   │   │   ├── app.ts              # App factory — error handler, plugins, routes
│   │   │   └── server.ts           # Entry point — starts HTTP server
│   │   ├── prisma/
│   │   │   ├── schema.prisma       # User, LogEntry, GeneratedSummary schema
│   │   │   └── migrations/
│   │   ├── prisma.config.ts        # Prisma 7 datasource configuration
│   │   └── .env
│   │
│   └── cli/
│       └── src/
│           ├── commands/
│           │   ├── init.ts         # standup init — create user, save config
│           │   ├── log.ts          # standup log — add a log entry
│           │   ├── history.ts      # standup history — view today's logs
│           │   ├── delete.ts       # standup delete — remove a log entry
│           │   ├── generate.ts     # standup generate — AI daily summary
│           │   └── weekly.ts       # standup weekly — AI weekly summary
│           ├── lib/
│           │   ├── config.ts       # Read/write ~/.standup-cli/config.json
│           │   ├── http.ts         # Axios instance with baseURL + API key header
│           │   ├── printer.ts      # Terminal output formatting
│           │   └── types.ts        # LogEntry interface
│           └── index.ts            # Entry point — Commander program, command registration
├── docker-compose.yml              # PostgreSQL + Redis containers
└── README.md
```

---

## 👤 Author

Built by [Kaushik](https://github.com/Kaushik-FSD) as a portfolio project demonstrating production backend engineering — monorepo architecture, Redis caching patterns, pluggable AI provider abstraction, and CLI tooling.
