# Scan & Push Flow

## Triggers

- **Scheduled**: cron job (recommended: every 4 hours, e.g. `0 1,5,9,13,17,21 * * *`)
- **Condition-based triggers are implemented through frequent scheduled scans.** Each scan checks for changes via snapshot diff. No push if nothing changed, so frequent scans are safe and non-intrusive.

## Flow

### 0. Daily Reset

```bash
node {baseDir}/bin/profile.ts reset-daily
```

### 1. Load User Profile

```bash
node {baseDir}/bin/profile.ts dump
```

Extract: `main_holdings`, `risk_preference`, `liquidity_requirement`, `holding_restriction`, `change_threshold`, `push_frequency`.

### 2. Fetch Market Data

Call in parallel:

```bash
# Earn products
node {baseDir}/bin/earn-api.ts list-flexible --size 50
node {baseDir}/bin/earn-api.ts list-locked --size 50
```

Also call **Market Ranking skill** and **Trading Signals skill** for market context (reference only).

### 3. Match & Filter

Filter product list against user profile:
- Risk level matches risk_preference
- Required asset is in user's holdings or asset_whitelist (if holding_restriction is no-sell, exclude products requiring a swap)
- Liquidity matches liquidity_requirement (high liquidity → prefer flexible, exclude long lock-ups)
- Sort by yield, keep top 3-5 candidates

**Zero candidates**: if no products match the user's profile, update `last_scan_time` and end. Do not push. In auto mode, skip execution entirely.

**Borrow-to-earn candidates**: if `margin-borrow` is in `allowed_operations` and `risk_preference` is not `conservative`, also check for products the user doesn't hold but could borrow for:

```bash
# Get borrow rates for potential assets
node {baseDir}/bin/margin-api.ts interest-rate --assets USDT,BTC,ETH

# Check current margin account health
node {baseDir}/bin/margin-api.ts account
```

Include a product as borrow-to-earn candidate only if:
- Earn APY minus annualized borrow rate > 2% (annualize: `hourlyRate * 24 * 365`)
- The collateral asset is in user's holdings
- Current margin level from `margin-api.ts account` is > 2.0 (if no existing borrows, check `borrowEnabled: true`)

Mark these products with `[borrow-to-earn]` in the push message.

### 4. Snapshot Comparison

Pipe the filtered candidates (as JSON array) into the snapshot diff tool:

```bash
echo '[{"name":"BNB Flexible","apy":5.4,...}, ...]' | node {baseDir}/bin/snapshot.ts diff --threshold 0.5
```

Output:
```json
{
  "changes": [
    {"name": "BNB Flexible", "type": "new", "apy": 5.4, "marker": "✅ New"},
    {"name": "USDT Locked 30d", "type": "changed", "old_apy": 7.1, "new_apy": 8.2, "delta": 1.1, "marker": "↑"}
  ],
  "removed": [],
  "has_changes": true
}
```

- `has_changes: false` → **do not push**, update scan time only, end
- `has_changes: true` → continue

**push_frequency handling** (check before pushing):
- `every-4h` → push on every scan that detects changes (default)
- `daily` → push at most once per day; if already pushed today (check snapshot `updated_at` date), skip
- `important-only` → only push when `type` is `"new"` or `delta` exceeds 2x `change_threshold`

### 5. Generate Push Message

Use the diff output to compose a push message. Fixed format, 1-3 items:

```
[Earn Opportunity Alert]
Based on your profile ([risk_preference] / [main_holdings] holdings), found N opportunity(ies):

1. [Product Name] — APY X.X%, [risk level], [liquidity] [marker]
2. [Product Name] — APY X.X%, [change description] [marker]

Data as of [time]. Refer to actual platform page for final rates.
To execute, just say: "Buy #1"
```

### 6. Update Snapshot

Pipe the full candidate list to update the snapshot:

```bash
echo '[{"name":"BNB Flexible","type":"flexible","apy":5.4,"risk":"low",...}]' | node {baseDir}/bin/snapshot.ts update
```

Update scan time:
```bash
node {baseDir}/bin/profile.ts set last_scan_time "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
```

### 7. Auto-Execute Check

```bash
node {baseDir}/bin/profile.ts get confirmation_mode
```

- **`confirm-first`** → flow ends. Wait for user to initiate execution.
- **`auto`** → for each pushed opportunity, trigger the execution flow (`{baseDir}/execute.md`):
  1. Determine amount: use product's `minPurchaseAmount` or derive from `single_amount_limit`
  2. Run full authorization check via `auth-check.ts` (auto mode does NOT skip any check)
  3. Convert amount if needed via `convert.ts`
  4. Execute via `earn-api.ts`
  5. Log result via `log.ts`
  6. If any execution fails, notify and continue to next opportunity

## End

Flow ends after push (confirm-first mode) or after auto-execution completes (auto mode).
