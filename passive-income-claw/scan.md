# Scan Flow

Default behavior: scan ALL feasible strategies, calculate real numbers, sort by net yield, present everything. Don't filter by subjective preferences — show data, let user decide.

## Triggers

- Cron job (recommended: every 4 hours)
- User asks "what's available" / "scan" / "recommend"
- First scan after setup

## Flow

### 0. Daily Reset

```bash
node {baseDir}/bin/profile.ts reset-daily
```

### 1. Gather Data (parallel)

```bash
# Holdings (per-asset breakdown)
node {baseDir}/bin/earn-api.ts balance

# Existing earn positions
node {baseDir}/bin/earn-api.ts positions --type flexible
node {baseDir}/bin/earn-api.ts positions --type locked
```

Use **Binance Spot skill** to get current prices, calculate USDT value for each asset. **Filter: only keep assets with value > 10 USDT.** This is the user's effective portfolio.

Then fetch earn products **only for the user's assets**:
```bash
# For each asset in effective portfolio (e.g. BNB, USDT, BTC):
node {baseDir}/bin/earn-api.ts list-flexible --asset BNB
node {baseDir}/bin/earn-api.ts list-flexible --asset USDT
node {baseDir}/bin/earn-api.ts list-locked --asset BNB
node {baseDir}/bin/earn-api.ts list-locked --asset USDT
# ... etc for each held asset
```

For borrow-to-earn, **only scan stablecoins and major coins** (small altcoins too volatile, spread gets eaten by price swings):

```bash
# Only if margin-borrow in allowed_operations

# Step 1: Get the top coins by market cap using Market Ranking skill
# Use the ranking to identify stablecoins + top 20 market cap coins

# Step 2: For each stablecoin and major coin, fetch earn products
# Example (actual list comes from Market Ranking):
node {baseDir}/bin/earn-api.ts list-flexible --asset USDT
node {baseDir}/bin/earn-api.ts list-flexible --asset USDC
node {baseDir}/bin/earn-api.ts list-locked --asset USDT
# ... etc for each stablecoin and major coin identified

# Step 3: Borrow rates
node {baseDir}/bin/margin-api.ts interest-rate --assets <comma-separated stablecoins + majors>
node {baseDir}/bin/margin-api.ts account
```

**Do NOT scan altcoins/meme coins for borrow-to-earn.** Price volatility makes the spread meaningless. Use **Market Ranking skill** to dynamically determine which coins qualify as "major" — don't hardcode a list.

### 2. Generate Candidate Strategies

**Path A — Direct Earn** (for each asset the user holds with value > 10 USDT):
- Match against earn products for that asset
- Feasibility: `balance[asset] > product.minPurchaseAmount`
- Net yield: product APY (no cost)
- Lock period: flexible (0) or fixed (N days)
- Risk: low

**Path B — Borrow-to-Earn** (for top-yield products the user doesn't hold):
- Only evaluate if `margin-borrow` in `allowed_operations`
- Only for products where: earn APY > borrow APY (skip obviously unprofitable ones first)
- Earn APY: product APY
- Borrow cost: `hourlyInterestRate × 24 × 365` (annualized)
- Net yield: Earn APY − Borrow APY
- Collateral: user's current holdings
- Margin level impact: estimate post-borrow margin level
- Risk: medium-high

**Skip if**:
- Product is sold out (`isSoldOut: true` or `canPurchase: false`)
- Net yield for borrow path < 0
- Asset value < 10 USDT (dust)

### 3. Score & Sort

For each candidate, compute a composite score:

```
Asset tier (by market cap and stability, not hardcoded list):
  stablecoin → +1.0
  major (top 20 by market cap) → +0.5
  other → +0.0

To determine asset tier, use **Token Details skill** to check:
- If the token is a stablecoin (pegged to fiat) → stablecoin tier
- If the token is in the top 20 by market cap → major tier
- Otherwise → other

score = net_yield
        + asset_tier_bonus
        - (lock_days > 0 ? 0.5 : 0)          // liquidity penalty
        - (path == "borrow" ? 1.0 : 0)        // complexity/risk penalty
        - (margin_level_after < 3.0 ? 2.0 : 0) // leverage risk penalty
```

Sort by score descending. Group into tiers:

| Tier | Criteria |
|------|----------|
| **Recommended** | score > 0, direct earn or borrow with net yield > 2% |
| **Possible** | score > 0 but low net yield or long lock |
| **Not worth it** | net yield < 1% or negative after costs |
| **Too risky** | margin level would drop below 2.0 |

### 4. Snapshot Comparison

```bash
echo '<candidates JSON>' | node {baseDir}/bin/snapshot.ts diff --threshold 0.5
```

- `has_changes: false` → no push, update scan time, end
- `has_changes: true` → continue

**push_frequency handling**:
- `every-4h` → push on every change (default)
- `daily` → at most once per day
- `important-only` → only new products or yield delta > 2x threshold

### 5. Generate Output

Present ALL tiers, not just "recommended". User sees the full picture.

```
📊 Passive Income Scan — [timestamp]
Holdings: BNB 12.5 (~8,250), USDT 3,200, BTC 0.02 (~1,960)

✅ Recommended:
1. USDT Flexible Earn — 4.2% APY, direct, withdraw anytime
2. BNB Flexible Earn — 3.8% APY, direct, withdraw anytime
3. USDT Locked 30d — 8.2% APY, direct, locked 30 days

💡 Possible (borrow-to-earn):
4. [borrow] USDT Locked 90d — earn 9.5% − borrow 3.2% = net 6.3%, locked 90d
   Collateral: BNB, margin level after: 4.1 (healthy)

⚠️ Not worth it:
5. BTC Locked 120d — 1.2% APY, long lock, low yield
6. [borrow] ETH Flexible — earn 2.1% − borrow 2.8% = net -0.7%

To execute: "buy #1" or "buy #1, 500 USDT"
```

### 6. Update Snapshot

```bash
echo '<all candidates JSON>' | node {baseDir}/bin/snapshot.ts update
node {baseDir}/bin/profile.ts set last_scan_time "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
```

### 7. Auto-Execute Check

```bash
node {baseDir}/bin/profile.ts get confirmation_mode
```

- `confirm-first` → flow ends, wait for user
- `auto` → execute only **Recommended** tier items:
  1. Run `auth-check.ts` for each
  2. Use **Binance Spot skill** for price conversion if needed
  3. Execute via `earn-api.ts` (or `margin-api.ts` + `earn-api.ts` for borrow path)
  4. Log via `log.ts`
  5. Send result notification
  6. If any fails, notify and continue to next

**Auto mode never executes "Possible", "Not worth it", or "Too risky" items.**
