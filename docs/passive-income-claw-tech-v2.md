# Passive Income Claw — 技术实现文档

**版本：** v2.1
**日期：** 2026-03-15
**运行环境：** OpenClaw + Binance Skills Hub + ClawHub

---

## 1. 交付产物

最终产物是一个发布在 ClawHub 上的 **Skill 包**。

**用户安装：**
```bash
clawhub install passive-income-claw
```

安装后 OpenClaw 热加载，无需重启，直接可用。

**Skill 包文件结构：**
```
passive-income-claw/
├── SKILL.md            ← 入口：路由、工具索引、元数据
├── scan.md             ← 扫描推送流程（调用 bin/ 工具）
├── execute.md          ← 执行流程（调用 bin/ 工具）
├── setup.md            ← 首次配置引导（对话 + profile.ts 写入）
├── path-analysis.md    ← 资产不匹配路径分析（LLM 推理）
├── memory-template.md  ← 用户画像和授权配置初始模板
├── bin/                ← 确定性操作脚本（TypeScript，通过 node 执行）
│   ├── earn-api.ts     ← Binance Earn API 客户端（封装签名和 HTTP）
│   ├── margin-api.ts   ← Binance Cross Margin API 客户端（借贷、还款、账户状态、历史查询）
│   ├── profile.ts      ← 用户画像 CRUD + 日清重置
│   ├── auth-check.ts   ← 5 步授权校验
│   ├── snapshot.ts     ← 快照 diff & 更新 & 读取
│   ├── convert.ts      ← USDT ↔ 资产币种换算（使用公开行情端点，无需 API Key）
│   ├── log.ts          ← 执行日志追加 & 查询
│   └── lib.ts          ← 共享工具函数（签名、HTTP、时间）
└── binance-earn/
    └── SKILL.md        ← earn-api.ts 接口说明 + 错误码参考
```

---

## 2. Binance 7 个 Skills 能力覆盖分析

### 2.1 官方 Skills 速查

| # | Skill | 核心能力 | 需要 API Key |
|---|-------|---------|------------|
| 1 | Binance Spot | 行情查询、下单/撤单、账户余额、OCO/OTOCO 订单 | ✅ |
| 2 | Address Insight | 钱包持仓分析、估值、24h 变化 | ❌ |
| 3 | Token Details | Token 基本信息、价格、市值 | ❌ |
| 4 | Market Ranking | 市场热度排名、涨跌幅排行 | ❌ |
| 5 | Meme Rush | Meme 代币链上热度分析 | ❌ |
| 6 | Trading Signals | 买卖信号、聪明钱追踪 | ❌ |
| 7 | Token Contract Audit | 合约风险检测、安全评估 | ❌ |

### 2.2 PRD 功能 × Skills 覆盖矩阵

| PRD 功能 | 使用的 Skill | 状态 |
|---------|------------|------|
| 账户余额 / 持仓查询 | Spot | ✅ |
| 市场行情与机会扫描 | Spot + Market Ranking + Trading Signals | ✅ |
| 风险评估 | Token Contract Audit | ✅ |
| 条件单执行（止盈止损） | Spot（OCO/OTOCO） | ✅ |
| 借贷路径分析 | 自建 margin-api.ts（Cross Margin API） | ✅ |
| 用户画像持久化 | OpenClaw Memory 机制 | ✅ |
| 定时扫描推送 | OpenClaw Cron 调度 | ✅ |
| **理财产品申购 / 赎回** | **无原生 Skill** | ⚠️ 需自建 |

### 2.3 关键 Gap：自建 Binance Earn Skill

7 个官方 Skills 中没有封装 Binance Simple Earn API。需自建 `binance-earn` Skill，调用以下端点（Simple Earn API v1）：

```
GET  /sapi/v1/simple-earn/flexible/list           # 活期理财产品列表
POST /sapi/v1/simple-earn/flexible/subscribe      # 申购活期理财
POST /sapi/v1/simple-earn/flexible/redeem         # 赎回活期理财
GET  /sapi/v1/simple-earn/flexible/position       # 活期持仓查询
GET  /sapi/v1/simple-earn/locked/list             # 定期产品列表
POST /sapi/v1/simple-earn/locked/subscribe        # 申购定期理财
GET  /sapi/v1/simple-earn/locked/position         # 定期持仓查询
GET  /sapi/v1/simple-earn/account                 # 理财账户总览
```

签名方式与 Spot Skill 完全一致，可直接复用 `auth-signing.md` 中的逻辑，工作量较小。

---

## 3. 整体架构

```
┌──────────────────────────────────────────────────────┐
│                   OpenClaw Gateway                    │
│                                                      │
│  ┌──────────────┐    ┌─────────────────────┐        │
│  │  Cron 调度器  │    │    磁盘文件存储       │        │
│  │  (定时触发)   │    │  用户画像 + 授权配置  │        │
│  │              │    │  机会快照 + 执行记录  │        │
│  └──────┬───────┘    └──────────┬──────────┘        │
│         │                       │                    │
│  ┌──────▼───────────────────────▼──────────────┐    │
│  │          Pi Agent Runtime                    │    │
│  │  · Agent Loop（工具执行、session 管理）       │    │
│  │  · 内置工具：bash, read, write, edit          │    │
│  │  · Skill 指令注入 system prompt              │    │
│  │                                              │    │
│  │  ┌────────────────────────────────────────┐  │    │
│  │  │     LLM（可配置，推荐最强可用模型）       │  │    │
│  │  │  · 画像匹配         · 推送内容生成       │  │    │
│  │  │  · 授权校验         · 路径分析推荐       │  │    │
│  │  └──────────────────┬─────────────────────┘  │    │
│  └─────────────────────┼────────────────────────┘    │
│                        │                             │
│  ┌─────────────────────▼────────────────────────┐    │
│  │              Skills Layer                     │    │
│  │  Spot  │ Market Ranking │ Trading Signals     │    │
│  │  Token Contract Audit  │ binance-earn（自建） │    │
│  └─────────────────────┬────────────────────────┘    │
└────────────────────────┼─────────────────────────────┘
                         │
             ┌───────────▼──────────┐
             │    Binance APIs      │
             │  Spot / Earn / Margin│
             └──────────────────────┘
```

---

## 4. 核心流程实现

### 4.1 用户画像与授权配置持久化

存储路径：`~/passive-income-claw/user-profile.md`

```markdown
# User Profile
risk_preference: balanced          # conservative / balanced / yield-focused
operation_frequency: low           # low / medium
liquidity_requirement: high        # high / medium / low
holding_restriction: no-sell       # no-sell / can-swap
main_holdings: BNB                 # BTC / ETH / BNB / USDT etc.

# Execution Authorization
execution_enabled: true            # true / false
confirmation_mode: confirm-first   # confirm-first / auto
single_amount_limit: 500 USDT     # max amount per operation
daily_amount_limit: 1000 USDT     # max cumulative amount per day
allowed_operations: [subscribe, redeem]  # subscribe / redeem / margin-borrow
asset_whitelist: [BNB, USDT, BTC] # list of assets that can be operated

# Notification Settings
push_frequency: every-4h           # every-4h / daily / important-only
change_threshold: 0.5%             # push when yield change exceeds this

# Execution Log (daily counters — reset at start of each day's first scan)
today_executed_amount: 0 USDT
last_execution_time: -
last_scan_time: -

# Persistent execution history is stored in ~/passive-income-claw/execution-log.md
```

Agent 在每次对话开始和执行完成后读写此文件。每日首次扫描时对比 `last_scan_time` 的日期与当天日期，若不同则重置 `today_executed_amount`。

**注意：** 初始模板中 `single_amount_limit` 和 `daily_amount_limit` 默认为 `0 USDT`，此时所有执行操作会被授权校验拦截。首次配置流程（setup.md）必须引导用户设置非零值。

---

### 4.2 机会快照存储

存储路径：`~/passive-income-claw/snapshot.md`

```markdown
# 机会快照
更新时间: 2026-03-09 09:00

## BNB 活期理财
年化: 5.4%
风险: 低
状态: 已推送

## USDT 定期 30 天
年化: 8.2%
风险: 中
状态: 已推送
```

每次扫描后更新，用于判断是否有新变化需要推送。

---

### 4.3 扫描推送流程

**触发方式：**
- 定时触发：Cron，推荐每 4 小时一次（`0 1,5,9,13,17,21 * * *`）
- 条件触发通过高频定时扫描实现：每次扫描对比快照，无变化不推送，有变化才推送，因此频繁扫描不会骚扰用户

**流程（推送后根据确认模式决定是否自动执行）：**

```
触发
  ↓
日清检查（对比 last_scan_time 日期，跨天则重置 today_executed_amount）
  ↓
读取用户画像
  ↓
调用 binance-earn Skill   → 获取理财产品列表 + 收益率
调用 Market Ranking Skill → 获取市场热度（仅作参考，非核心数据源）
调用 Trading Signals Skill → 获取当前信号（仅作参考，非核心数据源）
  ↓
Agent 匹配用户画像，筛选适合机会
  ↓
读取上次快照，对比变化
  ├── 无变化 → 不推送，更新快照时间戳，结束
  └── 有变化 → 继续
  ↓
生成推送内容（精简版，1～3 条）
  ↓
推送给用户
  ↓
更新快照
  ↓
检查确认模式
  ├── 执行前确认 → 结束（等待用户主动响应）
  └── 全自动     → 对每个推送机会触发执行流程（含完整授权校验）→ 推送执行结果
```

**推送内容格式：**
```
【收益机会提醒】
根据你的偏好（稳健型 / BNB 持仓），今天发现 2 个值得关注：

1. BNB 活期理财 — 年化 5.4%，风险低，可随时赎回 ✅ 新上线
2. USDT 定期 30 天 — 年化 8.2%，较上周上涨 1.1% ↑

如需执行，直接告诉我：「帮我买第 1 个」
```

---

### 4.4 执行流程

执行是独立入口，与扫描推送完全分离。

**两种触发来源：**
1. 用户主动指令：「帮我买」/「执行第 1 个」
2. 全自动模式：扫描完成后直接进入执行（无确认，无延迟）

```
执行触发
  ↓
授权校验（顺序执行，任一不通过立即终止并告知原因）
  ① 执行开关是否开启？
  ② 本次金额 ≤ 单次上限？
  ③ 今日已执行 + 本次 ≤ 单日累计上限？
  ④ 操作类型在允许列表内？
  ⑤ 资产在白名单内？
  ↓
调用 binance-earn Skill
→ POST /sapi/v1/simple-earn/flexible/subscribe（或 locked/subscribe）
  ↓
解析结果
  ✅ 成功    → 更新执行记录（金额、时间），推送成功通知
  ❌ 额度满  → 通知用户，推荐备选机会
  ❌ 余额不足 → 通知用户当前可用余额
  ❌ API 错误 → 通知用户，不自动重试，等待指令
```

---

### 4.5 自建 binance-earn Skill

`binance-earn/SKILL.md` 核心内容：

```markdown
---
name: binance-earn
description: |
  Query Binance Simple Earn product lists, subscribe to and redeem earn products,
  and check earn account positions. Use when fetching flexible or locked earn products,
  subscribing to earn products, redeeming earn products, or querying earn holdings.
metadata: '{"openclaw":{"requires":{"env":["BINANCE_API_KEY","BINANCE_API_SECRET"]}}}'
---

# Binance Earn Skill

All Binance Earn API operations are encapsulated in `{baseDir}/../bin/earn-api.ts`.
Do NOT construct curl commands manually — always use the CLI.

Before any write operation (subscribe / redeem), run authorization check first
via `{baseDir}/../bin/auth-check.ts`.

## CLI Reference

node {baseDir}/../bin/earn-api.ts list-flexible [--asset BNB] [--size 10]
node {baseDir}/../bin/earn-api.ts list-locked   [--asset USDT] [--size 10]
node {baseDir}/../bin/earn-api.ts subscribe-flexible --productId BNB001 --amount 100
node {baseDir}/../bin/earn-api.ts subscribe-locked   --projectId USDT30D --amount 500
node {baseDir}/../bin/earn-api.ts redeem-flexible --productId BNB001 --amount 100
node {baseDir}/../bin/earn-api.ts redeem-flexible --productId BNB001 --all
node {baseDir}/../bin/earn-api.ts redeem-locked   --positionId 12345
node {baseDir}/../bin/earn-api.ts positions --type flexible [--asset BNB]
node {baseDir}/../bin/earn-api.ts positions --type locked   [--asset USDT]
node {baseDir}/../bin/earn-api.ts account

All commands output JSON to stdout. On error, exit code is non-zero and error JSON is
written to stderr.

## Error Codes

| Code | Meaning | Action |
|------|---------|--------|
| -6003, -6004 | Product unavailable | Tell user product is not available |
| -6005 | Below minimum | Amount is below minimum purchase limit |
| -6011, -6014 | Quota exceeded | Product quota full, suggest alternatives |
| -6012, -6018 | Insufficient balance | Show available balance |
| -6006, -6007, -6008 | Redeem error | Explain specific redemption issue |
| Other | API error | Show error message, do not auto-retry |
```

---

## 5. 主 SKILL.md 结构

```markdown
---
name: passive-income-claw
description: |
  Binance passive income AI assistant. Automatically scans Binance earn opportunities,
  pushes matching opportunities based on user preferences, and executes subscriptions
  within authorized limits. Use when user mentions "passive income", "earn", "yield",
  "scan opportunities", "buy earn product", "what opportunities suit me".
  After install, tell the user: "Run /passive-income to get started, or just say
  'help me set up passive income'."
user-invocable: true
metadata: '{"openclaw":{"requires":{"env":["BINANCE_API_KEY","BINANCE_API_SECRET"]}}}'
---

# Passive Income Claw

## Tools

This skill includes TypeScript scripts in `{baseDir}/bin/` for all deterministic
operations. Always use these via `node {baseDir}/bin/<script>.ts` instead of doing
arithmetic, file parsing, or API calls manually.

| Script | Purpose |
|--------|---------|
| `bin/earn-api.ts` | Binance Earn API client |
| `bin/margin-api.ts` | Binance Cross Margin API client |
| `bin/profile.ts` | User profile read/write/daily-reset |
| `bin/auth-check.ts` | 5-step authorization validation |
| `bin/snapshot.ts` | Snapshot diff & update & read |
| `bin/convert.ts` | USDT ↔ asset currency conversion |
| `bin/log.ts` | Execution log append & query |

All scripts output JSON to stdout. Errors go to stderr with non-zero exit code.
All timestamps use UTC.

## Routing

- First use → setup.md
- User triggers execution → execute.md
- Scheduled scan → scan.md
- User asks about opportunities → load profile + fetch products + full recommendation
- Asset mismatch / borrow-to-earn → path-analysis.md
- Update preferences → profile.ts set
- Execution history → log.ts recent

Before all write operations: run auth-check.ts first.
```

**注意：** Cron 调度不在 SKILL.md frontmatter 中定义（OpenClaw 不支持）。需在首次配置时通过 CLI 注册：

```bash
openclaw cron add \
  --name "passive-income-scan" \
  --cron "0 1,5,9,13,17,21 * * *" \
  --message "Run passive income scan" \
  --session isolated
```

---

## 6. API Key 权限配置

安装引导时告知用户按以下最小权限配置：

| 权限 | 是否开启 | 原因 |
|------|---------|------|
| 读取（余额/持仓/历史） | ✅ 必须 | 查询账户状态 |
| 现货交易 | ❌ 不需要 | 价格查询使用公开端点，现货买卖不在 MVP 范围内 |
| 理财操作 | ✅ 需要 | 申购/赎回 Earn 产品 |
| 杠杆 / 合约 | ❌ 不开启 | 超出产品范围 |
| 提币 | ❌ 绝对禁止 | 安全红线 |
| IP 白名单 | ✅ 必须 | 绑定 OpenClaw 运行 IP |

---

## 7. 开发实施顺序

```
Step 1  自建 binance-earn Skill
        → 跑通所有 Earn API 端点（先 Testnet）
        → 验证签名逻辑复用

Step 2  用户画像与授权配置
        → 设计首次配置引导 Prompt（setup.md）
        → 实现画像读写逻辑
        → 实现授权校验逻辑

Step 3  扫描推送
        → 配置 Cron 调度
        → 实现快照对比逻辑
        → 实现推送内容生成

Step 4  执行引擎
        → 接入 binance-earn 执行申购/赎回
        → 实现执行记录更新
        → 实现异常处理和结果通知

Step 5  主动询问响应
        → 完整推荐输出（画像摘要 + 推荐 + 配置建议 + 路径分析）

Step 6  全流程测试
        → Testnet 跑通所有场景
        → 验证授权校验边界条件
        → 验证异常处理

Step 7  发布到 ClawHub
        → clawhub publish ./passive-income-claw
```

---

## 8. 技术风险与对策

| 风险 | 对策 |
|------|------|
| Earn 申购额度已满（-6011/-6014） | 检测错误码，通知用户并推荐备选产品 |
| 余额不足（-6012/-6018） | 通知用户当前可用余额 |
| API 时间戳偏差（-1021 错误） | 每次签名前同步 Binance 服务器时间 |
| Cron 调度中断未触发 | 记录每次调度执行时间；用户可查询「上次扫描时间」 |
| 收益率数据非实时 | 推送中标注数据获取时间，提示以实际为准 |
| 全自动模式下用户不知道执行了什么 | 每次执行后强制推送结果通知，不可关闭 |
| 授权金额 USDT 计价 vs API 原生资产数量 | 执行前通过 Spot 行情接口换算，确认和日志中同时展示两种金额 |
| 每日累计上限跨天未重置 | 扫描和执行流程均在开始时检查日期并重置计数器 |
