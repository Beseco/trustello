-- CreateTable
CREATE TABLE "SipgateConfig" (
    "id" TEXT NOT NULL,
    "resellerId" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "tokenEnc" BYTEA NOT NULL,
    "tokenIv" BYTEA NOT NULL,
    "tokenTag" BYTEA NOT NULL,
    "smsId" TEXT NOT NULL DEFAULT 's0',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SipgateConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SipgateConfig_resellerId_key" ON "SipgateConfig"("resellerId");

-- AddForeignKey
ALTER TABLE "SipgateConfig" ADD CONSTRAINT "SipgateConfig_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "Reseller"("id") ON DELETE CASCADE ON UPDATE CASCADE;
