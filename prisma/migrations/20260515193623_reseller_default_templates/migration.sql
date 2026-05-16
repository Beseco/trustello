-- CreateTable
CREATE TABLE "ResellerDefaultTemplate" (
    "id" TEXT NOT NULL,
    "resellerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResellerDefaultTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResellerDefaultTemplate_resellerId_idx" ON "ResellerDefaultTemplate"("resellerId");

-- AddForeignKey
ALTER TABLE "ResellerDefaultTemplate" ADD CONSTRAINT "ResellerDefaultTemplate_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "Reseller"("id") ON DELETE CASCADE ON UPDATE CASCADE;
