-- AddColumn entraId to User
ALTER TABLE "User" ADD COLUMN "entraId" TEXT;
ALTER TABLE "User" ADD CONSTRAINT "User_entraId_key" UNIQUE ("entraId");

-- CreateTable ScimToken
CREATE TABLE "ScimToken" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    CONSTRAINT "ScimToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ScimToken_tenantId_key" ON "ScimToken"("tenantId");

-- AddForeignKey
ALTER TABLE "ScimToken" ADD CONSTRAINT "ScimToken_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
