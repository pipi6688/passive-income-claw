# First-Time Setup

Run this flow when the user starts for the first time. Goal: build user profile and execution authorization through natural conversation.

## Step 1: Welcome & Explanation

Tell the user:
- This assistant periodically scans Binance earn opportunities and pushes relevant ones to you
- All operations execute strictly within your authorization limits — anything outside is rejected immediately
- No withdrawal operations will ever be performed; no yield guarantees

## Step 2: Collect User Preferences (natural conversation)

Ask the following one question at a time in plain language:

1. **Main holdings**: "Which assets do you mainly hold? e.g. BTC, ETH, BNB, USDT?"
2. **Risk tolerance**: "How do you feel about risk? Do you prefer stability, or are you OK with some volatility for higher yield?"
3. **Liquidity needs**: "Do you need to be able to withdraw anytime, or can you lock funds for a period?"

After collecting answers, convert to structured fields and confirm with the user:
"Based on what you told me, here's your profile summary: [list fields]. Does that look right?"

## Step 3: Configure Execution Authorization

Explain what execution authorization means, then ask:

1. **Auto-execute**: "Should I execute operations automatically, or confirm with you each time before doing anything?"
2. **Single amount limit**: "What's the maximum USDT amount per operation? (I'll refuse anything above this)"
3. **Daily limit**: "What's the maximum total USDT I can execute in a single day?"
4. **Allowed operation types**: "What operations can I perform? Subscribe to earn products? Redeem? Use your holdings as collateral to borrow and earn on other assets?"
5. **Asset whitelist**: "Which assets can I operate on? Just the holdings you mentioned, or others too?"

## Step 4: Save Configuration

Create `~/passive-income-claw/user-profile.md` by copying `{baseDir}/memory-template.md`, then set collected values:

```bash
mkdir -p ~/passive-income-claw
cp {baseDir}/memory-template.md ~/passive-income-claw/user-profile.md
node {baseDir}/bin/profile.ts set risk_preference "balanced"
node {baseDir}/bin/profile.ts set main_holdings "BNB, USDT"
node {baseDir}/bin/profile.ts set execution_enabled "true"
node {baseDir}/bin/profile.ts set confirmation_mode "confirm-first"
node {baseDir}/bin/profile.ts set single_amount_limit "500 USDT"
node {baseDir}/bin/profile.ts set daily_amount_limit "1000 USDT"
node {baseDir}/bin/profile.ts set allowed_operations "[subscribe, redeem]"
node {baseDir}/bin/profile.ts set asset_whitelist "[BNB, USDT]"
# ... etc with actual collected values
```

## Step 5: First Scan + Cron Setup

1. Run an immediate scan (see `{baseDir}/scan.md`) and show the first set of recommendations
2. Prompt the user to register the cron job. Recommend every-4-hour scanning for timely opportunity detection (the scan flow only pushes when something actually changed, so frequent scans won't cause spam):

```
Setup complete! To have me scan automatically, run this command:

openclaw cron add \
  --name "passive-income-scan" \
  --cron "0 1,5,9,13,17,21 * * *" \
  --message "Run passive income scan" \
  --session isolated

This scans every 4 hours. You'll only get a push when there's an actual change.
Want less frequent scans? Use "0 9 * * *" for once daily at 9:00 AM.
```

## API Key Permissions

If the user hasn't configured API keys yet, explain the minimum required permissions:

| Permission | Required |
|------------|---------|
| Read (balance / holdings / history) | ✅ Yes |
| Spot trading | ❌ Not needed (price queries use public endpoints) |
| Earn operations | ✅ Yes (subscribe / redeem) |
| Margin | ✅ Yes, if borrow-to-earn is enabled (cross margin borrow/repay) |
| Futures | ❌ Do not enable |
| Withdrawal | ❌ Never — hard security boundary |
| IP whitelist | ✅ Yes — bind to OpenClaw's running IP |

If the user does not plan to use borrow-to-earn, Margin permission can be left off.
