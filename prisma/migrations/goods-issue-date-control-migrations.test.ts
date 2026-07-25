import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migrationsDirectory = resolve(process.cwd(), "prisma/migrations");
const authoritativeMigration = readFileSync(
  resolve(migrationsDirectory, "20260725190653_add_goods_issue_date_import_control/migration.sql"),
  "utf8"
);
const followUpMigration = readFileSync(
  resolve(migrationsDirectory, "20260725201000_backfill_goods_issue_source_dates/migration.sql"),
  "utf8"
);

describe("Goods Issue Date control migrations", () => {
  it("keeps the authoritative migration schema-only and creates each date-control column once", () => {
    expect(authoritativeMigration).toContain('ADD COLUMN     "sapGoodsIssueDate" DATE');
    expect(authoritativeMigration).toContain('ADD COLUMN     "intendedGoodsIssueDate" DATE');
    expect(authoritativeMigration).not.toContain('UPDATE "order"');
  });

  it("limits the follow-up migration to the null-only backfill and acknowledgement index", () => {
    expect(followUpMigration).toContain('WHERE "sapGoodsIssueDate" IS NULL');
    expect(followUpMigration).toContain('AND "goodsIssueDate" IS NOT NULL');
    expect(followUpMigration).toContain(
      'CREATE INDEX "import_batch_dateMismatchAcknowledgedById_idx"'
    );
    expect(followUpMigration).not.toMatch(/ADD COLUMN|ADD CONSTRAINT/i);
  });
});
