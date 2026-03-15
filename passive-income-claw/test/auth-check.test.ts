import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkAuth } from "../bin/lib.ts";

const baseProfile = `
# User Profile
risk_preference: balanced
main_holdings: BNB

# Execution Authorization
execution_enabled: true
confirmation_mode: confirm-first
single_amount_limit: 500 USDT
daily_amount_limit: 1000 USDT
allowed_operations: [subscribe, redeem]
asset_whitelist: [BNB, USDT]

# Execution Log
today_executed_amount: 0 USDT
last_execution_time: -
last_scan_time: -
`;

describe("checkAuth", () => {
  it("passes when all checks are satisfied", () => {
    const r = checkAuth(baseProfile, { amount: 100, asset: "BNB", op: "subscribe" });
    assert.equal(r.pass, true);
    assert.equal(r.remaining_daily, 900);
  });

  it("fails check 1: execution disabled", () => {
    const profile = baseProfile.replace("execution_enabled: true", "execution_enabled: false");
    const r = checkAuth(profile, { amount: 100, asset: "BNB", op: "subscribe" });
    assert.equal(r.pass, false);
    assert.equal(r.check, 1);
  });

  it("fails check 2: exceeds single limit", () => {
    const r = checkAuth(baseProfile, { amount: 600, asset: "BNB", op: "subscribe" });
    assert.equal(r.pass, false);
    assert.equal(r.check, 2);
    assert.ok(r.reason!.includes("600"));
    assert.ok(r.reason!.includes("500"));
  });

  it("fails check 3: exceeds daily limit", () => {
    const profile = baseProfile.replace("today_executed_amount: 0 USDT", "today_executed_amount: 800 USDT");
    const r = checkAuth(profile, { amount: 300, asset: "BNB", op: "subscribe" });
    assert.equal(r.pass, false);
    assert.equal(r.check, 3);
  });

  it("passes check 3: exactly at daily limit", () => {
    const profile = baseProfile.replace("today_executed_amount: 0 USDT", "today_executed_amount: 500 USDT");
    const r = checkAuth(profile, { amount: 500, asset: "BNB", op: "subscribe" });
    assert.equal(r.pass, true);
    assert.equal(r.remaining_daily, 0);
  });

  it("fails check 4: operation not allowed", () => {
    const r = checkAuth(baseProfile, { amount: 100, asset: "BNB", op: "margin-borrow" });
    assert.equal(r.pass, false);
    assert.equal(r.check, 4);
  });

  it("fails check 5: asset not in whitelist", () => {
    const r = checkAuth(baseProfile, { amount: 100, asset: "ETH", op: "subscribe" });
    assert.equal(r.pass, false);
    assert.equal(r.check, 5);
  });

  it("check 4 uses exact match, not substring", () => {
    // "sub" should not match "subscribe"
    const r = checkAuth(baseProfile, { amount: 100, asset: "BNB", op: "sub" });
    assert.equal(r.pass, false);
    assert.equal(r.check, 4);
  });

  it("check 5 uses exact match, not substring", () => {
    // "BN" should not match "BNB"
    const r = checkAuth(baseProfile, { amount: 100, asset: "BN", op: "subscribe" });
    assert.equal(r.pass, false);
    assert.equal(r.check, 5);
  });

  it("case insensitive for operation and asset", () => {
    const r = checkAuth(baseProfile, { amount: 100, asset: "bnb", op: "SUBSCRIBE" });
    assert.equal(r.pass, true);
  });

  it("checks are sequential: stops at first failure", () => {
    const profile = baseProfile.replace("execution_enabled: true", "execution_enabled: false");
    // Even though amount also exceeds limit, should fail at check 1
    const r = checkAuth(profile, { amount: 9999, asset: "FAKECOIN", op: "invalid" });
    assert.equal(r.check, 1);
  });

  it("passes check 2: exactly at single limit", () => {
    const r = checkAuth(baseProfile, { amount: 500, asset: "BNB", op: "subscribe" });
    assert.equal(r.pass, true);
  });

  it("pure function does not guard against invalid input (CLI responsibility)", () => {
    // checkAuth itself doesn't validate amount > 0; CLI wrapper does
    const r = checkAuth(baseProfile, { amount: -100, asset: "BNB", op: "subscribe" });
    // negative amount passes single/daily checks because -100 < 500 and -100 < 1000
    assert.equal(r.pass, true);
  });

  it("handles margin-borrow when in allowed_operations", () => {
    const profile = baseProfile.replace(
      "allowed_operations: [subscribe, redeem]",
      "allowed_operations: [subscribe, redeem, margin-borrow]"
    );
    const r = checkAuth(profile, { amount: 100, asset: "USDT", op: "margin-borrow" });
    assert.equal(r.pass, true);
  });
});
