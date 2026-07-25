import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const sql = readFileSync(new URL("./migration.sql", import.meta.url), "utf8");

describe("20260724224112_add_delivery_order_links migration contract", () => {
  it("creates the unique Delivery and Order key before the idempotent legacy backfill", () => {
    const uniqueIndex = sql.indexOf(
      'CREATE UNIQUE INDEX "delivery_order_link_deliveryId_orderId_key"'
    );
    const backfill = sql.indexOf('INSERT INTO "delivery_order_link"');

    expect(uniqueIndex).toBeGreaterThan(-1);
    expect(backfill).toBeGreaterThan(uniqueIndex);
    expect(sql).toContain('ON CONFLICT ("deliveryId", "orderId") DO NOTHING');
  });

  it("creates one deterministic BACKFILL link for every legacy Delivery orderId without changing it", () => {
    expect(sql).toContain('md5(d."id"::text || \':\' || d."orderId"::text)::uuid');
    expect(sql).toContain("'BACKFILL'::\"DeliveryOrderLinkSource\"");
    expect(sql).toContain('FROM "delivery" d');
    expect(sql).not.toMatch(/UPDATE\s+"delivery"/i);
    expect(sql).not.toMatch(/ALTER TABLE\s+"delivery".*DROP COLUMN/i);
  });

  it("prevents orphan links while allowing an imported audit user to be removed", () => {
    expect(sql).toContain('REFERENCES "delivery"("id") ON DELETE RESTRICT');
    expect(sql).toContain('REFERENCES "order"("id") ON DELETE RESTRICT');
    expect(sql).toContain('REFERENCES "user"("id") ON DELETE SET NULL');
    expect(sql).toMatch(/"createdById" UUID,\s*\n/);
  });
});
