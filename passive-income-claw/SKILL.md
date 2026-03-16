---
name: passive-income-claw
version: 0.1.0
description: |
  Binance passive income AI assistant. Automatically scans Binance earn opportunities,
  pushes matching opportunities based on user preferences, and executes subscriptions
  within authorized limits. Use when user mentions "passive income", "earn", "yield",
  "scan opportunities", "buy earn product", "what opportunities suit me".
  After install, tell the user: "Run /passive-income to get started, or just say 'help me set up passive income'."
user-invocable: true
metadata: '{"openclaw":{"requires":{"env":["BINANCE_API_KEY","BINANCE_API_SECRET"]}}}'
---

# Passive Income Claw

## Tools

This skill includes TypeScript scripts in `{baseDir}/bin/` for all deterministic operations. **Always use these via `node {baseDir}/bin/<script>.ts` instead of doing arithmetic, file parsing, or API calls manually.**

| Script | Purpose |
|--------|---------|
| `bin/earn-api.ts` | Binance Earn API client (Simple Earn 产品查询/申购/赎回) |
| `bin/margin-api.ts` | Binance Cross Margin API client (借贷、还款、账户状态、利率) |
| `bin/profile.ts` | User profile read/write/daily-reset |
| `bin/auth-check.ts` | 5-step authorization validation |
| `bin/snapshot.ts` | Snapshot diff & update |
| `bin/log.ts` | Execution log append & query |

### Official Binance Skills (already installed, use directly)

| Skill | 用途 |
|-------|------|
| **Binance Spot** | 账户余额查询、行情价格查询、币种换算 |
| **Market Ranking** | 市场热度、涨跌幅排行（扫描时参考） |
| **Trading Signals** | 买卖信号（扫描时参考） |
| **Token Details** | Token 基本信息、价格、市值 |

**不要用 earn-api.ts 查余额或价格 — 用 Binance Spot skill。**
**不要自己写币种换算 — 用 Binance Spot skill 查行情价格。**

All scripts output JSON to stdout (including `profile.ts get` and `set`). Errors go to stderr as JSON with non-zero exit code. All timestamps use UTC.

## Routing

**First use** (`~/passive-income-claw/user-profile.md` does not exist):
→ Read `{baseDir}/setup.md` to guide user through configuration, then return here

**User triggers execution** ("buy", "execute #N", "redeem"):
→ Read `{baseDir}/execute.md`

**Scheduled scan triggered** (cron job):
→ Read `{baseDir}/scan.md`

**User asks about opportunities** ("what's available", "recommend something for me"):
→ Load user profile: `node {baseDir}/bin/profile.ts dump`
→ Query holdings: use **Binance Spot skill** to get account balance
→ Fetch products: `node {baseDir}/bin/earn-api.ts list-flexible` and `list-locked`
→ Output full recommendation:
  1. Profile summary (current preferences and authorization limits)
  2. Top 3-5 picks with reasoning, risk level, and liquidity
  3. Configuration suggestions (1-3 preset strategies: conservative / balanced / yield-focused, each with concrete parameter values)
  4. Risk explanation for each recommendation
  5. If any pick requires an asset the user doesn't hold → run path analysis per `{baseDir}/path-analysis.md`
  6. One-line summary

**User wants to update preferences** ("change my settings", "update risk preference", "raise my limit"):
→ Show current values: `node {baseDir}/bin/profile.ts dump`
→ Collect new values through natural conversation
→ Update: `node {baseDir}/bin/profile.ts set <key> <value>`
→ Confirm changes back to the user

**User asks about asset mismatch or borrow-to-earn** ("I don't hold that asset", "how can I participate", "can I borrow to earn"):
→ Read `{baseDir}/path-analysis.md` — includes feasibility check, risk analysis, and execution via `margin-api.ts`

**User asks about execution history** ("what did you execute", "show my history"):
→ Run `node {baseDir}/bin/log.ts recent 20`
→ If no entries, tell the user: "No executions recorded yet."

**Before all write operations**: run `node {baseDir}/bin/auth-check.ts` first.
