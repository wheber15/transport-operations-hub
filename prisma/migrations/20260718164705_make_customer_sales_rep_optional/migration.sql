-- DropForeignKey
ALTER TABLE "customer" DROP CONSTRAINT "customer_salesRepId_fkey";

-- AlterTable
ALTER TABLE "customer" ALTER COLUMN "salesRepId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "customer" ADD CONSTRAINT "customer_salesRepId_fkey" FOREIGN KEY ("salesRepId") REFERENCES "sales_rep"("id") ON DELETE SET NULL ON UPDATE CASCADE;
