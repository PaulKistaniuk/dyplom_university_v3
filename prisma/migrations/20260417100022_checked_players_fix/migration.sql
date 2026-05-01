-- AlterTable
ALTER TABLE "GamePlayer" ADD COLUMN     "checkedPlayers" JSONB NOT NULL DEFAULT '[]';
