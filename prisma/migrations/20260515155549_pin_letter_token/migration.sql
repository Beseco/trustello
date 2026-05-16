-- CreateTable
CREATE TABLE "LetterxpressConfig" (
    "id" TEXT NOT NULL,
    "resellerId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "apiKeyEnc" BYTEA NOT NULL,
    "apiKeyIv" BYTEA NOT NULL,
    "apiKeyTag" BYTEA NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LetterxpressConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PinLetterToken" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "qrToken" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "supersededAt" TIMESTAMP(3),
    "letterxpressId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PinLetterToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LetterxpressConfig_resellerId_key" ON "LetterxpressConfig"("resellerId");

-- CreateIndex
CREATE UNIQUE INDEX "PinLetterToken_qrToken_key" ON "PinLetterToken"("qrToken");

-- CreateIndex
CREATE INDEX "PinLetterToken_customerId_idx" ON "PinLetterToken"("customerId");

-- CreateIndex
CREATE INDEX "PinLetterToken_qrToken_idx" ON "PinLetterToken"("qrToken");

-- AddForeignKey
ALTER TABLE "LetterxpressConfig" ADD CONSTRAINT "LetterxpressConfig_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "Reseller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PinLetterToken" ADD CONSTRAINT "PinLetterToken_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PinLetterToken" ADD CONSTRAINT "PinLetterToken_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
