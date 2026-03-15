import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { diffSnapshots, parseSnapshotContent } from "../bin/lib.ts";
import type { SnapshotProduct } from "../bin/lib.ts";

function product(overrides: Partial<SnapshotProduct> = {}): SnapshotProduct {
  return {
    name: "BNB Flexible",
    type: "flexible",
    apy: 5.4,
    risk: "low",
    liquidity: "flexible",
    asset: "BNB",
    productId: "BNB001",
    projectId: "",
    minPurchaseAmount: "0.1",
    ...overrides,
  };
}

describe("diffSnapshots", () => {
  it("returns no changes when products are identical", () => {
    const old = [product()];
    const r = diffSnapshots(old, [product()]);
    assert.equal(r.has_changes, false);
    assert.equal(r.changes.length, 0);
    assert.equal(r.removed.length, 0);
  });

  it("detects new product", () => {
    const old = [product()];
    const newP = [product(), product({ name: "USDT Locked 30d", apy: 8.2, asset: "USDT" })];
    const r = diffSnapshots(old, newP);
    assert.equal(r.has_changes, true);
    assert.equal(r.changes.length, 1);
    assert.equal(r.changes[0].type, "new");
    assert.equal(r.changes[0].name, "USDT Locked 30d");
    assert.equal(r.changes[0].marker, "✅ New");
  });

  it("detects removed product", () => {
    const old = [product(), product({ name: "USDT Locked", apy: 8.0 })];
    const newP = [product()];
    const r = diffSnapshots(old, newP);
    assert.equal(r.has_changes, true);
    assert.equal(r.removed.length, 1);
    assert.equal(r.removed[0].name, "USDT Locked");
  });

  it("detects yield increase above threshold", () => {
    const old = [product({ apy: 5.0 })];
    const newP = [product({ apy: 6.0 })];
    const r = diffSnapshots(old, newP, 0.5);
    assert.equal(r.has_changes, true);
    assert.equal(r.changes.length, 1);
    assert.equal(r.changes[0].type, "changed");
    assert.equal(r.changes[0].old_apy, 5.0);
    assert.equal(r.changes[0].new_apy, 6.0);
    assert.equal(r.changes[0].delta, 1.0);
    assert.equal(r.changes[0].marker, "↑");
  });

  it("detects yield decrease above threshold", () => {
    const old = [product({ apy: 6.0 })];
    const newP = [product({ apy: 4.5 })];
    const r = diffSnapshots(old, newP, 0.5);
    assert.equal(r.has_changes, true);
    assert.equal(r.changes[0].marker, "↓");
    assert.equal(r.changes[0].delta, -1.5);
  });

  it("ignores yield change within threshold", () => {
    const old = [product({ apy: 5.0 })];
    const newP = [product({ apy: 5.3 })];
    const r = diffSnapshots(old, newP, 0.5);
    assert.equal(r.has_changes, false);
  });

  it("ignores change exactly at threshold", () => {
    const old = [product({ apy: 5.0 })];
    const newP = [product({ apy: 5.5 })];
    const r = diffSnapshots(old, newP, 0.5);
    assert.equal(r.has_changes, false); // > threshold, not >=
  });

  it("handles empty old snapshot (all new)", () => {
    const newP = [product(), product({ name: "USDT Locked", apy: 8.0 })];
    const r = diffSnapshots([], newP);
    assert.equal(r.has_changes, true);
    assert.equal(r.changes.length, 2);
    assert.ok(r.changes.every((c) => c.type === "new"));
  });

  it("handles empty new snapshot (all removed)", () => {
    const old = [product()];
    const r = diffSnapshots(old, []);
    assert.equal(r.has_changes, true);
    assert.equal(r.removed.length, 1);
  });

  it("handles both empty", () => {
    const r = diffSnapshots([], []);
    assert.equal(r.has_changes, false);
  });

  it("handles multiple simultaneous changes", () => {
    const old = [
      product({ name: "A", apy: 5.0 }),
      product({ name: "B", apy: 3.0 }),
      product({ name: "C", apy: 7.0 }),
    ];
    const newP = [
      product({ name: "A", apy: 6.5 }), // changed
      product({ name: "D", apy: 9.0 }), // new
      // B removed, C removed
    ];
    const r = diffSnapshots(old, newP, 0.5);
    assert.equal(r.has_changes, true);
    assert.equal(r.changes.length, 2);
    assert.equal(r.removed.length, 2);

    // Verify identities, not just counts
    const changed = r.changes.find((c) => c.type === "changed");
    assert.ok(changed);
    assert.equal(changed!.name, "A");

    const added = r.changes.find((c) => c.type === "new");
    assert.ok(added);
    assert.equal(added!.name, "D");

    const removedNames = r.removed.map((r) => r.name).sort();
    assert.deepEqual(removedNames, ["B", "C"]);
  });
});

describe("parseSnapshotContent (markdown format)", () => {
  it("parses snapshot markdown into product objects", () => {
    const md = `# Opportunity Snapshot
updated_at: 2026-03-15T09:00:00Z

## BNB Flexible
type: flexible
apy: 5.4%
risk: low
liquidity: flexible
asset: BNB
productId: BNB001
projectId:
minPurchaseAmount: 0.1
status: pushed

## USDT Locked 30d
type: locked
apy: 8.2%
risk: medium
liquidity: fixed-30d
asset: USDT
productId:
projectId: USDT30D
minPurchaseAmount: 100
status: pushed
`;
    const products = parseSnapshotContent(md);
    assert.equal(products.length, 2);
    assert.equal(products[0].name, "BNB Flexible");
    assert.equal(products[0].apy, 5.4);
    assert.equal(products[0].asset, "BNB");
    assert.equal(products[0].productId, "BNB001");
    assert.equal(products[1].name, "USDT Locked 30d");
    assert.equal(products[1].apy, 8.2);
    assert.equal(products[1].projectId, "USDT30D");
  });

  it("returns empty array for empty content", () => {
    assert.deepEqual(parseSnapshotContent(""), []);
  });

  it("round-trips: parse → diff with same data → no changes", () => {
    const md = `## Test Product\ntype: flexible\napy: 5.0%\nasset: BNB\nproductId: T001\n`;
    const parsed = parseSnapshotContent(md);
    const r = diffSnapshots(parsed, parsed);
    assert.equal(r.has_changes, false);
  });
});
