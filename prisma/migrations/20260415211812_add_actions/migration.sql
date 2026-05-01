-- AlterTable
ALTER TABLE "GameSession" ADD COLUMN     "actions" JSONB NOT NULL DEFAULT '{}';
