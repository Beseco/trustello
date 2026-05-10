-- CreateEnum
CREATE TYPE "ResellerAdminRole" AS ENUM ('OWNER', 'ADMIN', 'SUPPORT', 'READ_ONLY');

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OURole" AS ENUM ('MEMBER', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('TENANT_ADMIN', 'USER_MANAGER', 'CUSTOMER_MANAGER', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "CustomerVisibility" AS ENUM ('PRIVATE', 'ORGANISATION', 'OU');

-- CreateEnum
CREATE TYPE "TrustLevel" AS ENUM ('NONE', 'EMAIL', 'SMS', 'PIN_LETTER', 'BAYERN_ID_S', 'BAYERN_ID_H', 'EID');

-- CreateEnum
CREATE TYPE "SecurityLevel" AS ENUM ('LEVEL_1', 'LEVEL_2', 'LEVEL_3', 'LEVEL_4');

-- CreateEnum
CREATE TYPE "VirusScanStatus" AS ENUM ('PENDING', 'CLEAN', 'INFECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "MessageEventType" AS ENUM ('SENT', 'DELIVERED_NOTIFICATION', 'OPENED', 'ATTACHMENT_DOWNLOADED', 'REPLIED', 'EXPIRED', 'DELETED', 'PASSWORD_FAILED', 'TRUST_CHECK_FAILED');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('USER', 'CUSTOMER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ImportType" AS ENUM ('USERS', 'CUSTOMERS');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "Reseller" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "logoUrl" TEXT,
    "primaryColor" TEXT,
    "customDomain" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reseller_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResellerAdmin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "totpSecret" TEXT,
    "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "resellerId" TEXT NOT NULL,
    "role" "ResellerAdminRole" NOT NULL DEFAULT 'ADMIN',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResellerAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "resellerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "monthlyPrice" DECIMAL(10,2) NOT NULL,
    "setupFee" DECIMAL(10,2) NOT NULL,
    "maxUsers" INTEGER NOT NULL,
    "storageGB" INTEGER NOT NULL,
    "maxFileSizeMB" INTEGER NOT NULL DEFAULT 100,
    "retentionDays" INTEGER NOT NULL DEFAULT 90,
    "hasOutlookAddin" BOOLEAN NOT NULL DEFAULT false,
    "hasBayernID" BOOLEAN NOT NULL DEFAULT false,
    "hasEID" BOOLEAN NOT NULL DEFAULT false,
    "hasAPI" BOOLEAN NOT NULL DEFAULT false,
    "isTrial" BOOLEAN NOT NULL DEFAULT false,
    "trialDays" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "resellerId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "billingEmail" TEXT NOT NULL,
    "billingAddress" JSONB NOT NULL,
    "autoLoginDomains" TEXT[],
    "logoUrl" TEXT,
    "primaryColor" TEXT,
    "customDomain" TEXT,
    "tenantMasterKey" BYTEA NOT NULL,
    "tmkIv" BYTEA NOT NULL,
    "tmkAuthTag" BYTEA NOT NULL,
    "storageUsedBytes" BIGINT NOT NULL DEFAULT 0,
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "trialEndsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantSettings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "allowEmployeeOUCreate" BOOLEAN NOT NULL DEFAULT false,
    "allowCustomerReplyDefault" BOOLEAN NOT NULL DEFAULT true,
    "allowSubjectEncryption" BOOLEAN NOT NULL DEFAULT true,
    "defaultSecurityLevel" "SecurityLevel" NOT NULL DEFAULT 'LEVEL_2',
    "defaultMinTrustLevel" "TrustLevel" NOT NULL DEFAULT 'EMAIL',
    "retentionDaysOverride" INTEGER,
    "imprintHtml" TEXT,
    "privacyPolicyHtml" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganisationUnit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganisationUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserOnOU" (
    "userId" TEXT NOT NULL,
    "ouId" TEXT NOT NULL,
    "role" "OURole" NOT NULL DEFAULT 'MEMBER',

    CONSTRAINT "UserOnOU_pkey" PRIMARY KEY ("userId","ouId")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "salutation" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "totpSecret" TEXT,
    "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "roles" "UserRole"[],
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "salutation" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "mobilePhone" TEXT,
    "landlinePhone" TEXT,
    "street" TEXT,
    "zipCode" TEXT,
    "city" TEXT,
    "country" TEXT DEFAULT 'DE',
    "visibility" "CustomerVisibility" NOT NULL DEFAULT 'PRIVATE',
    "ownerUserId" TEXT,
    "trustLevel" "TrustLevel" NOT NULL DEFAULT 'NONE',
    "trustVerifiedAt" TIMESTAMP(3),
    "hasAccount" BOOLEAN NOT NULL DEFAULT false,
    "passwordHash" TEXT,
    "totpSecret" TEXT,
    "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "publicKey" BYTEA,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerOnOU" (
    "customerId" TEXT NOT NULL,
    "ouId" TEXT NOT NULL,

    CONSTRAINT "CustomerOnOU_pkey" PRIMARY KEY ("customerId","ouId")
);

-- CreateTable
CREATE TABLE "CustomerNote" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustMethod" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "method" "TrustLevel" NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "TrustMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "subjectIsEncrypted" BOOLEAN NOT NULL DEFAULT false,
    "subjectPlain" TEXT,
    "subjectCiphertext" BYTEA,
    "subjectIv" BYTEA,
    "subjectAuthTag" BYTEA,
    "bodyCiphertext" BYTEA NOT NULL,
    "bodyIv" BYTEA NOT NULL,
    "bodyAuthTag" BYTEA NOT NULL,
    "securityLevel" "SecurityLevel" NOT NULL,
    "minTrustLevel" "TrustLevel" NOT NULL,
    "messageKey" BYTEA NOT NULL,
    "messageKeyIv" BYTEA NOT NULL,
    "messageKeyAuthTag" BYTEA NOT NULL,
    "passwordHint" TEXT,
    "passwordSalt" BYTEA,
    "allowReply" BOOLEAN NOT NULL DEFAULT true,
    "allowReplyAttach" BOOLEAN NOT NULL DEFAULT true,
    "isFileRequest" BOOLEAN NOT NULL DEFAULT false,
    "fileRequestPrompt" TEXT,
    "parentMessageId" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstReadAt" TIMESTAMP(3),
    "lastReadAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "legalHold" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "filenameCiphertext" BYTEA NOT NULL,
    "filenameIv" BYTEA NOT NULL,
    "filenameAuthTag" BYTEA NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "contentIv" BYTEA NOT NULL,
    "contentAuthTag" BYTEA NOT NULL,
    "virusScanStatus" "VirusScanStatus" NOT NULL DEFAULT 'PENDING',
    "virusScanResult" TEXT,
    "uploadedByCustomer" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageEvent" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "eventType" "MessageEventType" NOT NULL,
    "actorType" "ActorType" NOT NULL,
    "actorId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "scopes" TEXT[],
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "ImportType" NOT NULL,
    "status" "ImportStatus" NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "successRows" INTEGER NOT NULL DEFAULT 0,
    "errorRows" INTEGER NOT NULL DEFAULT 0,
    "errorReport" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Reseller_customDomain_key" ON "Reseller"("customDomain");

-- CreateIndex
CREATE UNIQUE INDEX "ResellerAdmin_email_key" ON "ResellerAdmin"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_customDomain_key" ON "Tenant"("customDomain");

-- CreateIndex
CREATE UNIQUE INDEX "TenantSettings_tenantId_key" ON "TenantSettings"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_tenantId_email_key" ON "Customer"("tenantId", "email");

-- CreateIndex
CREATE INDEX "MessageEvent_messageId_createdAt_idx" ON "MessageEvent"("messageId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

-- AddForeignKey
ALTER TABLE "ResellerAdmin" ADD CONSTRAINT "ResellerAdmin_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "Reseller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "Reseller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "Reseller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantSettings" ADD CONSTRAINT "TenantSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganisationUnit" ADD CONSTRAINT "OrganisationUnit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganisationUnit" ADD CONSTRAINT "OrganisationUnit_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "OrganisationUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserOnOU" ADD CONSTRAINT "UserOnOU_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserOnOU" ADD CONSTRAINT "UserOnOU_ouId_fkey" FOREIGN KEY ("ouId") REFERENCES "OrganisationUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerOnOU" ADD CONSTRAINT "CustomerOnOU_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerOnOU" ADD CONSTRAINT "CustomerOnOU_ouId_fkey" FOREIGN KEY ("ouId") REFERENCES "OrganisationUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerNote" ADD CONSTRAINT "CustomerNote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerNote" ADD CONSTRAINT "CustomerNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustMethod" ADD CONSTRAINT "TrustMethod_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_parentMessageId_fkey" FOREIGN KEY ("parentMessageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageEvent" ADD CONSTRAINT "MessageEvent_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
