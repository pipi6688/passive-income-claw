import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getField, setField, profileDump, parseNumeric, parseList, resetDaily } from "../bin/lib.ts";

const sampleProfile = `# User Profile
risk_preference: balanced          # conservative / balanced / yield-focused
operation_frequency: low           # low / medium
main_holdings: BNB, USDT

# Execution Authorization
execution_enabled: true
single_amount_limit: 500 USDT     # max per op
daily_amount_limit: 1000 USDT
allowed_operations: [subscribe, redeem]
asset_whitelist: [BNB, USDT, BTC]

# Execution Log
today_executed_amount: 300 USDT
last_execution_time: 2026-03-15T09:00:00Z
last_scan_time: 2026-03-15T05:00:00Z
`;

describe("getField", () => {
  it("reads simple field", () => {
    assert.equal(getField(sampleProfile, "risk_preference"), "balanced");
  });

  it("reads field with inline comment", () => {
    assert.equal(getField(sampleProfile, "single_amount_limit"), "500 USDT");
  });

  it("reads field with comma-separated values", () => {
    assert.equal(getField(sampleProfile, "main_holdings"), "BNB, USDT");
  });

  it("reads field with brackets", () => {
    assert.equal(getField(sampleProfile, "allowed_operations"), "[subscribe, redeem]");
  });

  it("returns null for missing field", () => {
    assert.equal(getField(sampleProfile, "nonexistent"), null);
  });

  it("ignores comment lines", () => {
    assert.equal(getField(sampleProfile, "# User Profile"), null);
  });
});

describe("setField", () => {
  it("updates simple field", () => {
    const result = setField(sampleProfile, "risk_preference", "conservative");
    assert.equal(getField(result, "risk_preference"), "conservative");
  });

  it("preserves inline comment", () => {
    const result = setField(sampleProfile, "single_amount_limit", "1000 USDT");
    assert.ok(result.includes("# max per op"));
    assert.equal(getField(result, "single_amount_limit"), "1000 USDT");
  });

  it("does not affect other fields", () => {
    const result = setField(sampleProfile, "risk_preference", "conservative");
    assert.equal(getField(result, "daily_amount_limit"), "1000 USDT");
    assert.equal(getField(result, "execution_enabled"), "true");
  });

  it("throws for missing field", () => {
    assert.throws(() => setField(sampleProfile, "nonexistent", "value"));
  });
});

describe("profileDump", () => {
  it("returns all key-value pairs", () => {
    const dump = profileDump(sampleProfile);
    assert.equal(dump.risk_preference, "balanced");
    assert.equal(dump.execution_enabled, "true");
    assert.equal(dump.today_executed_amount, "300 USDT");
  });

  it("strips inline comments from values", () => {
    const dump = profileDump(sampleProfile);
    assert.equal(dump.single_amount_limit, "500 USDT");
  });

  it("skips comment lines and empty lines", () => {
    const dump = profileDump(sampleProfile);
    assert.equal(dump["# User Profile"], undefined);
  });
});

describe("parseNumeric", () => {
  it("extracts number from '500 USDT'", () => {
    assert.equal(parseNumeric("500 USDT"), 500);
  });

  it("extracts decimal", () => {
    assert.equal(parseNumeric("3.14 BTC"), 3.14);
  });

  it("returns 0 for non-numeric", () => {
    assert.equal(parseNumeric("abc"), 0);
  });

  it("extracts from '0.5%'", () => {
    assert.equal(parseNumeric("0.5%"), 0.5);
  });
});

describe("parseList", () => {
  it("parses bracketed list", () => {
    assert.deepEqual(parseList("[subscribe, redeem]"), ["subscribe", "redeem"]);
  });

  it("parses without brackets", () => {
    assert.deepEqual(parseList("BNB, USDT, BTC"), ["bnb", "usdt", "btc"]);
  });

  it("lowercases all entries", () => {
    assert.deepEqual(parseList("[Subscribe, REDEEM]"), ["subscribe", "redeem"]);
  });

  it("handles empty", () => {
    assert.deepEqual(parseList("[]"), []);
  });

  it("handles single item", () => {
    assert.deepEqual(parseList("[subscribe]"), ["subscribe"]);
  });
});

describe("resetDaily", () => {
  it("resets on first run (last_scan_time is -)", () => {
    const profile = sampleProfile.replace("last_scan_time: 2026-03-15T05:00:00Z", "last_scan_time: -");
    const { content, result } = resetDaily(profile, "2026-03-15");
    assert.equal(result.reset, true);
    assert.equal(result.reason, "first_run");
    assert.equal(getField(content, "today_executed_amount"), "0 USDT");
  });

  it("resets when date changes", () => {
    const { content, result } = resetDaily(sampleProfile, "2026-03-16");
    assert.equal(result.reset, true);
    assert.equal(result.reason, "new_day");
    assert.equal(result.last, "2026-03-15");
    assert.equal(getField(content, "today_executed_amount"), "0 USDT");
  });

  it("does not reset on same day", () => {
    const { content, result } = resetDaily(sampleProfile, "2026-03-15");
    assert.equal(result.reset, false);
    // today_executed_amount should remain unchanged
    assert.equal(getField(content, "today_executed_amount"), "300 USDT");
  });

  it("preserves other fields when resetting", () => {
    const { content } = resetDaily(sampleProfile, "2026-03-16");
    assert.equal(getField(content, "risk_preference"), "balanced");
    assert.equal(getField(content, "single_amount_limit"), "500 USDT");
  });

  it("handles missing today_executed_amount gracefully", () => {
    const minimalProfile = `last_scan_time: 2026-03-14T00:00:00Z\nrisk_preference: balanced`;
    const { content, result } = resetDaily(minimalProfile, "2026-03-15");
    assert.equal(result.reset, true);
    // setFieldSafe returns original content when field not found
    assert.equal(content, minimalProfile);
  });
});
