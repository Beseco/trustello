-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "citizenAccountId" TEXT;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "ouId" TEXT,
ADD COLUMN     "senderIsAnonymous" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "vaultMessageKey" BYTEA,
ADD COLUMN     "vaultMessageKeyAuthTag" BYTEA,
ADD COLUMN     "vaultMessageKeyIv" BYTEA;

-- CreateTable
CREATE TABLE "CitizenAccount" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "passwordHash" TEXT,
    "totpSecret" TEXT,
    "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "vaultSalt" BYTEA,
    "vaultKey" BYTEA,
    "vaultKeyIv" BYTEA,
    "vaultKeyAuthTag" BYTEA,
    "vaultKeyMaster" BYTEA,
    "vaultKeyMasterIv" BYTEA,
    "vaultKeyMasterAuthTag" BYTEA,
    "vaultEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CitizenAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CitizenInviteToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "citizenAccountId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CitizenInviteToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CitizenPasswordResetToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "citizenAccountId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CitizenPasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CitizenAccount_email_key" ON "CitizenAccount"("email");

-- CreateIndex
CREATE UNIQUE INDEX "CitizenInviteToken_token_key" ON "CitizenInviteToken"("token");

-- CreateIndex
CREATE INDEX "CitizenInviteToken_token_idx" ON "CitizenInviteToken"("token");

-- CreateIndex
CREATE INDEX "CitizenInviteToken_email_idx" ON "CitizenInviteToken"("email");

-- CreateIndex
CREATE UNIQUE INDEX "CitizenPasswordResetToken_token_key" ON "CitizenPasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "CitizenPasswordResetToken_token_idx" ON "CitizenPasswordResetToken"("token");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_citizenAccountId_fkey" FOREIGN KEY ("citizenAccountId") REFERENCES "CitizenAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_ouId_fkey" FOREIGN KEY ("ouId") REFERENCES "OrganisationUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CitizenInviteToken" ADD CONSTRAINT "CitizenInviteToken_citizenAccountId_fkey" FOREIGN KEY ("citizenAccountId") REFERENCES "CitizenAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CitizenPasswordResetToken" ADD CONSTRAINT "CitizenPasswordResetToken_citizenAccountId_fkey" FOREIGN KEY ("citizenAccountId") REFERENCES "CitizenAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
