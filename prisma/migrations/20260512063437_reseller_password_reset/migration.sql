-- AlterTable
ALTER TABLE "PasswordResetToken" ADD COLUMN     "resellerAdminId" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_resellerAdminId_fkey" FOREIGN KEY ("resellerAdminId") REFERENCES "ResellerAdmin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
