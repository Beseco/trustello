-- AlterTable
ALTER TABLE "TenantSettings" ADD COLUMN     "signatureTemplate" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "phone" TEXT,
ADD COLUMN     "position" TEXT;
