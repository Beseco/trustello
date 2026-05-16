-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "smsMonthlyQuota" INTEGER;

-- CreateTable
CREATE TABLE "SmsUsage" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "resellerId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "notified80" BOOLEAN NOT NULL DEFAULT false,
    "notified90" BOOLEAN NOT NULL DEFAULT false,
    "notified100" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SmsUsage_resellerId_month_idx" ON "SmsUsage"("resellerId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "SmsUsage_customerId_month_key" ON "SmsUsage"("customerId", "month");

-- AddForeignKey
ALTER TABLE "SmsUsage" ADD CONSTRAINT "SmsUsage_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsUsage" ADD CONSTRAINT "SmsUsage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
