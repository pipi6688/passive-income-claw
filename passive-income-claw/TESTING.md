# 测试文档

## 测试总览

| Phase | 类型 | 方式 | 需要 OpenClaw | 状态 |
|-------|------|------|:---:|------|
| 0 | 自动化单元测试（纯函数） | `node --test` | ❌ | ✅ 55/55 pass |
| 1.1 | convert.ts CLI | 手动命令行 | ❌ | ✅ 4/4 pass |
| 1.2 | earn-api.ts CLI | 手动命令行 | ❌ 需 API Key | ⬜ 待测 |
| 1.3 | margin-api.ts CLI | 手动命令行 | ❌ 需 API Key + Margin 权限 | ⬜ 待测 |
| 1.4 | profile.ts CLI | 手动命令行 | ❌ | ✅ 5/5 pass |
| 1.5 | auth-check.ts CLI | 手动命令行 | ❌ | ✅ 5/5 pass |
| 1.6 | snapshot.ts CLI | 手动命令行 | ❌ | ✅ 5/5 pass |
| 1.7 | log.ts CLI | 手动命令行 | ❌ | ✅ 4/4 pass |
| 2.1 | 首次配置流程 | 手动对话 | ✅ | ⬜ 待测 |
| 2.2 | 扫描推送 | 手动对话 | ✅ | ⬜ 待测 |
| 2.3 | 用户主动询问 | 手动对话 | ✅ | ⬜ 待测 |
| 2.4 | 手动执行 | 手动对话 | ✅ | ⬜ 待测 |
| 2.5 | 偏好更新 | 手动对话 | ✅ | ⬜ 待测 |
| 2.6 | 执行记录查询 | 手动对话 | ✅ | ⬜ 待测 |
| 2.7 | 借贷套利分析 | 手动对话 | ✅ | ⬜ 待测 |
| 2.8 | Cron 扫描 | 手动 | ✅ | ⬜ 待测 |
| 3.1 | 执行开关关闭 | 手动对话 | ✅ | ⬜ 待测 |
| 3.2 | 连续扫描无变化 | 手动对话 | ✅ | ⬜ 待测 |
| 3.3 | Profile 不存在 | 手动对话 | ✅ | ⬜ 待测 |
| 3.4 | 日累计限额耗尽 | 手动对话 | ✅ | ⬜ 待测 |

---

## Phase 0：自动化单元测试 ✅

```bash
cd passive-income-claw
node --experimental-strip-types --no-warnings --test test/*.test.ts
```

55 tests，覆盖：checkAuth（14）、diffSnapshots（11）、parseSnapshotContent（3）、getField/setField（10）、profileDump（3）、parseNumeric/parseList（9）、resetDaily（5）

**每次改 bin/ 代码后都要跑这个。**

---

## Phase 1：脚本 CLI 测试（部分完成）

测试每个脚本作为独立命令行工具能正常工作。Phase 0 测的是纯函数逻辑，这里测的是参数解析、文件 I/O、错误输出格式。

**不需要 API Key 的已全部通过**（1.1, 1.4, 1.5, 1.6, 1.7）。**需要 API Key 的待测**（1.2, 1.3）。

### 前置准备

```bash
export BINANCE_API_KEY="你的key"
export BINANCE_API_SECRET="你的secret"
rm -rf ~/passive-income-claw
```

> 推荐用 Testnet：改 `bin/lib.ts` 第 8 行为 `https://testnet.binance.vision`，测完改回。

### 1.1 convert.ts — 币种换算（不需要 API Key）

```bash
# ✅ 基本换算
node bin/convert.ts 500 USDT BNB
# 期望: {"amount": <非零数>, "asset": "BNB", "rate": <当前价>, ...}

# ✅ 同币种
node bin/convert.ts 100 USDT USDT
# 期望: {"amount": 100, "asset": "USDT", "rate": 1, "source": "identity"}

# ✅ 不存在的币对
node bin/convert.ts 100 USDT FAKECOIN
# 期望: stderr {"error": "No trading pair found for USDT/FAKECOIN"}，exit code 1

# ✅ 缺参数
node bin/convert.ts
# 期望: stderr {"error": ...}
```

### 1.2 earn-api.ts — Earn API 客户端（需要 API Key）

```bash
# ✅ 查询活期产品
node bin/earn-api.ts list-flexible --size 3
# 期望: JSON，包含 rows 数组

# ✅ 查询定期产品
node bin/earn-api.ts list-locked --asset USDT --size 3

# ✅ 查询账户
node bin/earn-api.ts account

# ✅ 缺少参数
node bin/earn-api.ts subscribe-flexible
# 期望: stderr {"error": "Missing --productId"}

# ✅ 无效命令
node bin/earn-api.ts invalid-command
# 期望: stderr 错误提示
```

### 1.3 margin-api.ts — Margin API 客户端（需要 API Key + Margin 权限）

```bash
# ✅ 查询资产信息
node bin/margin-api.ts asset-info --asset USDT
# 期望: {"asset": "USDT", "borrowable": true/false, ...}

# ✅ 最大可借
node bin/margin-api.ts max-borrowable --asset USDT

# ✅ 利率查询
node bin/margin-api.ts interest-rate --assets USDT,BTC

# ✅ 账户状态
node bin/margin-api.ts account
```

### 1.4 profile.ts — 用户画像管理（不需要 API Key）

```bash
# 准备
mkdir -p ~/passive-income-claw
cp memory-template.md ~/passive-income-claw/user-profile.md

# ✅ dump
node bin/profile.ts dump
# 期望: JSON 包含所有字段

# ✅ get（positional 写法）
node bin/profile.ts get risk_preference
# 期望: {"risk_preference": "balanced"}

# ✅ set（positional 写法）
node bin/profile.ts set risk_preference yield-focused
node bin/profile.ts get risk_preference
# 期望: {"risk_preference": "yield-focused"}
node bin/profile.ts set risk_preference balanced

# ✅ reset-daily
node bin/profile.ts reset-daily
# 期望: {"reset": true, "reason": "first_run", ...} 或 {"reset": false, ...}
```

### 1.5 auth-check.ts — 授权校验（不需要 API Key）

```bash
# 先配置 profile
node bin/profile.ts set execution_enabled true
node bin/profile.ts set single_amount_limit "500 USDT"
node bin/profile.ts set daily_amount_limit "1000 USDT"
node bin/profile.ts set allowed_operations "[subscribe, redeem]"
node bin/profile.ts set asset_whitelist "[BNB, USDT]"

# ✅ 通过
node bin/auth-check.ts --amount 100 --asset BNB --op subscribe
# 期望: {"pass": true, "remaining_daily": 900, ...}

# ✅ 超过单次限额
node bin/auth-check.ts --amount 600 --asset BNB --op subscribe
# 期望: {"pass": false, "check": 2, ...}

# ✅ 资产不在白名单
node bin/auth-check.ts --amount 100 --asset ETH --op subscribe
# 期望: {"pass": false, "check": 5, ...}

# ✅ 操作不在允许列表
node bin/auth-check.ts --amount 100 --asset BNB --op margin-borrow
# 期望: {"pass": false, "check": 4, ...}

# ✅ 无效金额
node bin/auth-check.ts --amount -100 --asset BNB --op subscribe
# 期望: stderr {"error": "Missing or invalid --amount..."}
```

### 1.6 snapshot.ts — 快照管理（不需要 API Key）

```bash
# ✅ 首次读取
node bin/snapshot.ts read
# 期望: {"updated_at": "", "products": []}

# ✅ 写入
echo '[{"name":"BNB Flexible","type":"flexible","apy":5.4,"risk":"low","liquidity":"flexible","asset":"BNB","productId":"BNB001","projectId":"","minPurchaseAmount":"0.1"}]' | node bin/snapshot.ts update
# 期望: {"updated": true, "timestamp": "...", "count": 1}

# ✅ 再读取
node bin/snapshot.ts read
# 期望: products 数组非空

# ✅ 无变化 diff
echo '[{"name":"BNB Flexible","type":"flexible","apy":5.4,"risk":"low","liquidity":"flexible","asset":"BNB","productId":"BNB001","projectId":"","minPurchaseAmount":"0.1"}]' | node bin/snapshot.ts diff
# 期望: {"has_changes": false, ...}

# ✅ 有变化 diff
echo '[{"name":"BNB Flexible","type":"flexible","apy":6.2,"risk":"low","liquidity":"flexible","asset":"BNB","productId":"BNB001","projectId":"","minPurchaseAmount":"0.1"}]' | node bin/snapshot.ts diff
# 期望: {"has_changes": true, "changes": [{...}]}
```

### 1.7 log.ts — 执行日志（不需要 API Key）

```bash
# ✅ 记录成功
node bin/log.ts append --op subscribe --product "BNB Flexible" --amount 100 --asset BNB --result success
# 期望: {"logged": true, "result": "success", "today_total": "100 USDT"}

# ✅ 记录失败（不增加 today_total）
node bin/log.ts append --op subscribe --product "USDT Locked" --amount 500 --asset USDT --result "Quota full"
# 期望: today_total 仍为 "100 USDT"

# ✅ 查看最近记录
node bin/log.ts recent 5
# 期望: {"entries": [...], "count": 2}

# ✅ 检查文件
cat ~/passive-income-claw/execution-log.md
```

### Phase 1 完成标志

- [x] convert.ts — 换算、同币种、错误币对、缺参数 ✅
- [x] profile.ts — dump、get、set、positional args、reset-daily ✅
- [x] auth-check.ts — 通过、超限、白名单、操作类型、无效金额 ✅
- [x] snapshot.ts — 读、写、再读、无变化diff、有变化diff ✅
- [x] log.ts — 成功记录、失败不加total、recent、文件格式 ✅
- [ ] earn-api.ts — 需要 API Key，在 OpenClaw 配好 key 后测
- [ ] margin-api.ts — 需要 API Key + Margin 权限，在 OpenClaw 配好 key 后测
- [x] 错误情况输出 JSON 到 stderr，exit code 非零 ✅
- [x] positional 和 --flag 两种参数写法都能用 ✅

---

## Phase 2：OpenClaw 集成测试 ⬜

测试 LLM 能否按照 markdown 指令正确调用脚本，完成完整业务流程。

### 前置准备

```bash
# 安装 skill
cp -r ./passive-income-claw ~/.openclaw/skills/

# 配置 API Key（在 ~/.openclaw/openclaw.json）
# 清理旧数据
rm -rf ~/passive-income-claw

# 验证加载
openclaw skills list           # passive-income-claw 应出现
openclaw skills info passive-income-claw
```

### 2.1 首次配置流程（正常流 — 最重要）

```bash
openclaw agent --message "帮我设置被动收益"
```

预期流程（最快 2 轮完成）：

| 轮次 | 系统做什么 | 你回答 |
|------|-----------|--------|
| 1 | 验证 API Key → 扫描余额 + earn 持仓 → 推断画像 → 一屏展示全部配置 + "要改什么？" | "ok" |
| 2 | 保存配置 → 首次扫描推荐 → **自动注册 cron** → "搞定" | （检查输出） |

验证点：
- [ ] **先验证了 API Key 有效性**
- [ ] **自动查询了余额，不问用户持仓**
- [ ] **自动推断了风险偏好**（看持仓结构）
- [ ] **自动推断了流动性需求**（看 earn 持仓）
- [ ] **授权限额基于账户总额推算**（不是随意的默认值）
- [ ] 所有配置一屏展示，用户一句 "ok" 过掉
- [ ] 写入了 `~/passive-income-claw/user-profile.md`
- [ ] 展示了首次扫描推荐
- [ ] **自动注册了 cron，不让用户手动跑命令**
- [ ] 如果用户说"单次改成 500" → 只调那一项，不重新走流程

```bash
# 验证
cat ~/passive-income-claw/user-profile.md
node bin/profile.ts dump
```

### 2.2 扫描推送

```bash
openclaw agent --message "Run passive income scan"
```

验证点：
- [ ] 调用了 `earn-api.ts list-flexible` 和/或 `list-locked`
- [ ] 根据画像筛选了产品
- [ ] 生成了推送消息（如果有变化）或说"无变化"
- [ ] 更新了 snapshot.md 和 last_scan_time

```bash
cat ~/passive-income-claw/snapshot.md
node bin/profile.ts get last_scan_time
```

### 2.3 用户主动询问

```bash
openclaw agent --message "现在有什么适合我的机会？"
```

验证点：
- [ ] 展示画像摘要
- [ ] 列出 3-5 个推荐
- [ ] 包含风险说明
- [ ] 有一句话总结

### 2.4 手动执行（confirm-first 模式）

```bash
openclaw agent --message "帮我买第 1 个，100 USDT"
```

验证点：
- [ ] 解析出产品和金额
- [ ] 调用了 `auth-check.ts`
- [ ] 如果资产不是 USDT，调用了 `convert.ts` 换算
- [ ] 展示确认摘要，等你说 "yes"
- [ ] 你回复 "yes" 后调用 `earn-api.ts subscribe-*`
- [ ] 调用 `log.ts append` 记录
- [ ] 展示执行结果

```bash
cat ~/passive-income-claw/execution-log.md
node bin/profile.ts get today_executed_amount
```

### 2.5 偏好更新

```bash
openclaw agent --message "把我的单次上限改成 1000"
```

验证点：
- [ ] 展示当前值
- [ ] 调用 `profile.ts set` 更新
- [ ] 确认新值

```bash
node bin/profile.ts get single_amount_limit
# 期望: {"single_amount_limit": "1000 USDT"}
```

### 2.6 执行记录查询

```bash
openclaw agent --message "看看我的执行记录"
```

验证点：
- [ ] 调用了 `log.ts recent`
- [ ] 以可读格式展示历史

### 2.7 借贷套利分析

```bash
openclaw agent --message "我想参与 USDT 定期理财，但我只有 BNB"
```

验证点：
- [ ] 触发 path-analysis.md 流程
- [ ] 调用 `margin-api.ts asset-info` 检查可借性
- [ ] 调用 `margin-api.ts interest-rate` 查利率
- [ ] 计算净收益（earn APY - borrow APY）
- [ ] 评估 margin level
- [ ] 展示分析结果（含风险说明）

### 2.8 Cron 扫描

```bash
# 注册一个 2 分钟后触发的一次性任务
openclaw cron add \
  --name "test-scan" \
  --at "$(date -u -v+2M +%Y-%m-%dT%H:%M:%SZ)" \
  --message "Run passive income scan" \
  --session isolated

# 等 2 分钟后检查
openclaw cron runs --limit 1
```

验证点：
- [ ] cron 任务成功执行
- [ ] snapshot.md 被更新

### Phase 2 完成标志

- [ ] 2.1 首次配置正常走完
- [ ] 2.2 扫描推送正常
- [ ] 2.3 主动询问有完整推荐
- [ ] 2.4 手动执行 + 确认闭环
- [ ] 2.5 偏好更新生效
- [ ] 2.6 执行记录可查
- [ ] 2.7 借贷分析展示正确
- [ ] 2.8 Cron 能触发

---

## Phase 3：边界条件测试 ⬜

Phase 0 的自动化测试已覆盖大部分边界（授权校验5步、快照阈值、日清重置、精确匹配）。以下是需要在 OpenClaw 里手动验证的剩余场景。

### 3.1 执行开关关闭

```bash
node bin/profile.ts set execution_enabled false
openclaw agent --message "帮我买第 1 个"
# 期望: 被拦截，提示执行已禁用
node bin/profile.ts set execution_enabled true
```

### 3.2 连续扫描无变化不推送

```bash
openclaw agent --message "Run passive income scan"
# 第一次: 有推送

openclaw agent --message "Run passive income scan"
# 第二次: 应说"无变化，不推送"
```

### 3.3 Profile 不存在时触发 setup

```bash
rm ~/passive-income-claw/user-profile.md
openclaw agent --message "现在有什么机会"
# 期望: 触发首次配置流程，而不是报错
```

### 3.4 日累计限额耗尽

```bash
node bin/profile.ts set single_amount_limit "100 USDT"
node bin/profile.ts set daily_amount_limit "150 USDT"

openclaw agent --message "帮我买第 1 个，100 USDT"
# 期望: 通过，执行

openclaw agent --message "再买一个，100 USDT"
# 期望: 被拦截，提示超过日累计限额（已用 100，再加 100 > 150）
```

---

## 清理

```bash
rm -rf ~/passive-income-claw
openclaw cron remove <test-scan-job-id>  # 如果注册了测试 cron
```
