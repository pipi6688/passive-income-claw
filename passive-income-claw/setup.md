# First-Time Setup

Run this flow when the user starts for the first time. Goal: auto-detect as much as possible, show the user one confirmation screen, get a single "ok".

## Step 1: Validate API Key

Before anything else, verify the API key works and has the right permissions:

```bash
node {baseDir}/bin/earn-api.ts account
```

- If it succeeds → key is valid, earn permission OK
- If it fails with -2008 (invalid key) → tell user to check their API key config
- If it fails with permission error → tell user which permissions are missing

Then check margin access (optional):
```bash
node {baseDir}/bin/margin-api.ts account
```
- If it succeeds → margin is available, can offer borrow-to-earn later
- If it fails → that's fine, just skip borrow-to-earn features

## Step 2: Auto-Scan Everything

Query three things in parallel, don't ask the user anything:

### 2a. Spot balance (holdings)
```bash
node {baseDir}/bin/earn-api.ts balance
```
Returns per-asset breakdown (free, locked, total) for all non-zero assets. Use **Binance Spot skill** to get current prices and filter out dust (< 1 USDT equivalent).

### 2b. Existing earn positions
```bash
node {baseDir}/bin/earn-api.ts positions --type flexible
node {baseDir}/bin/earn-api.ts positions --type locked
```

### 2c. Available earn products
```bash
node {baseDir}/bin/earn-api.ts list-flexible --size 50
node {baseDir}/bin/earn-api.ts list-locked --size 50
```

## Step 3: Infer Profile (don't ask, derive)

### Risk preference
Infer from portfolio composition:
- > 70% stablecoins (USDT, USDC, BUSD, DAI, FDUSD) → `conservative`
- > 50% blue chips (BTC, ETH, BNB) + stablecoins → `balanced`
- Significant altcoin/meme holdings → `yield-focused`

### Liquidity requirement
Infer from existing earn positions:
- User has locked earn products → `medium` (accepts some lock-up)
- User has only flexible earn products → `high` (prefers liquidity)
- No earn positions at all → default `high`

### Authorization limits
Derive from total account value:
- `single_amount_limit`: round down to nearest 100 of (total_value × 10%)
- `daily_amount_limit`: round down to nearest 100 of (total_value × 20%)
- Minimum: single=100 USDT, daily=200 USDT

### Asset whitelist
Default to all non-dust assets found in the scan.

## Step 4: Present & Confirm (one screen)

Show everything at once. The user just confirms or adjusts:

```
I've scanned your Binance account. Here's what I found and the config I'd suggest:

📊 Your Holdings:
- BNB: 12.5 (~8,250 USDT)
- USDT: 3,200
- BTC: 0.02 (~1,960 USDT)
Total: ~13,410 USDT

📊 Existing Earn Positions:
- BNB Flexible Earn: 5.0 BNB (APY 5.4%)
- (none locked)

🔧 Recommended Config:
- Risk: balanced (you hold mostly blue chips + stablecoins)
- Liquidity: high (you only have flexible positions)
- Execute mode: confirm each time
- Single op limit: 1,300 USDT (10% of total)
- Daily limit: 2,600 USDT (20% of total)
- Assets I can operate: BNB, USDT, BTC
- Operations: subscribe, redeem

Want to change anything? Or just say "ok" to start.
```

If user says "ok" or equivalent → proceed.
If user says "改成自动模式" or "单次上限改成 500" → adjust only that field, don't re-ask everything.

## Step 5: Save Configuration

```bash
mkdir -p ~/passive-income-claw
cp {baseDir}/memory-template.md ~/passive-income-claw/user-profile.md
node {baseDir}/bin/profile.ts set risk_preference "balanced"
node {baseDir}/bin/profile.ts set main_holdings "BNB, USDT, BTC"
node {baseDir}/bin/profile.ts set execution_enabled "true"
node {baseDir}/bin/profile.ts set confirmation_mode "confirm-first"
node {baseDir}/bin/profile.ts set single_amount_limit "1300 USDT"
node {baseDir}/bin/profile.ts set daily_amount_limit "2600 USDT"
node {baseDir}/bin/profile.ts set allowed_operations "[subscribe, redeem]"
node {baseDir}/bin/profile.ts set asset_whitelist "[BNB, USDT, BTC]"
# ... use actual inferred/confirmed values
```

## Step 6: First Scan + Auto-Register Cron

1. Run an immediate scan (see `{baseDir}/scan.md`) and show the first set of recommendations

2. **Automatically register the cron job** (don't ask the user to run a command):

```bash
openclaw cron add \
  --name "passive-income-scan" \
  --cron "0 1,5,9,13,17,21 * * *" \
  --message "Run passive income scan" \
  --session isolated
```

Tell the user:
```
Done! I've set up automatic scanning every 4 hours.
You'll get a push whenever I find something new that matches your profile.
To change the frequency, just tell me.
```

## API Key Permissions

If the user hasn't configured API keys yet (Step 1 fails), explain the minimum required:

| Permission | Required |
|------------|---------|
| Read (balance / holdings / history) | ✅ Yes |
| Spot trading | ❌ Not needed |
| Earn operations | ✅ Yes (subscribe / redeem) |
| Margin | ✅ If borrow-to-earn is wanted |
| Futures | ❌ Do not enable |
| Withdrawal | ❌ Never |
| IP whitelist | ✅ Bind to OpenClaw's running IP |
