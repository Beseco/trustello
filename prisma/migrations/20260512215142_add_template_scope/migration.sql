-- CreateEnum
CREATE TYPE "TemplateScope" AS ENUM ('GLOBAL', 'OU', 'USER');

-- DropIndex
DROP INDEX "MessageTemplate_tenantId_idx";

-- AlterTable
ALTER TABLE "MessageTemplate" ADD COLUMN     "ouId" TEXT,
ADD COLUMN     "scope" "TemplateScope" NOT NULL DEFAULT 'GLOBAL';

-- CreateIndex
CREATE INDEX "MessageTemplate_tenantId_scope_idx" ON "MessageTemplate"("tenantId", "scope");

-- CreateIndex
CREATE INDEX "MessageTemplate_ouId_idx" ON "MessageTemplate"("ouId");

-- AddForeignKey
ALTER TABLE "MessageTemplate" ADD CONSTRAINT "MessageTemplate_ouId_fkey" FOREIGN KEY ("ouId") REFERENCES "OrganisationUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
