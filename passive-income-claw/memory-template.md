# User Profile
risk_preference: balanced          # conservative / balanced / yield-focused
operation_frequency: low           # low / medium
liquidity_requirement: high        # high / medium / low
holding_restriction: no-sell       # no-sell / can-swap
main_holdings: USDT                # BTC / ETH / BNB / USDT etc.

# Execution Authorization
execution_enabled: false           # true / false
confirmation_mode: confirm-first   # confirm-first / auto
single_amount_limit: 0 USDT        # max amount per operation
daily_amount_limit: 0 USDT         # max cumulative amount per day
allowed_operations: [subscribe, redeem]  # subscribe / redeem / margin-borrow
asset_whitelist: []                # list of assets that can be operated

# Notification Settings
push_frequency: every-4h           # every-4h / daily / important-only
change_threshold: 0.5%             # push when yield change exceeds this

# Execution Log (daily counters — reset at start of each day's first scan)
today_executed_amount: 0 USDT
last_execution_time: -
last_scan_time: -

# Persistent execution history is stored in ~/passive-income-claw/execution-log.md
