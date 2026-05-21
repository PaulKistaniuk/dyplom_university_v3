/*
  Warnings:

  - You are about to drop the column `checkedPlayers` on the `GamePlayer` table. All the data in the column will be lost.
  - You are about to drop the column `checksUsed` on the `GamePlayer` table. All the data in the column will be lost.
  - You are about to drop the column `hasVoted` on the `GamePlayer` table. All the data in the column will be lost.
  - You are about to drop the column `healsUsed` on the `GamePlayer` table. All the data in the column will be lost.
  - You are about to drop the column `isAlive` on the `GamePlayer` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[gameId,number]` on the table `GamePlayer` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[lobbyId,number]` on the table `LobbyPlayer` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `number` to the `GamePlayer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `gameId` to the `GameResult` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "GamePlayer" DROP CONSTRAINT "GamePlayer_gameId_fkey";

-- AlterTable
ALTER TABLE "GamePlayer" DROP COLUMN "checkedPlayers",
DROP COLUMN "checksUsed",
DROP COLUMN "hasVoted",
DROP COLUMN "healsUsed",
DROP COLUMN "isAlive",
ADD COLUMN     "number" INTEGER NOT NULL,
ADD COLUMN     "personal" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "state" JSONB NOT NULL DEFAULT '{}',
ALTER COLUMN "role" DROP NOT NULL;

-- AlterTable
ALTER TABLE "GameResult" ADD COLUMN     "gameId" TEXT NOT NULL,
ALTER COLUMN "stats" SET DEFAULT '{}';

-- AlterTable
ALTER TABLE "GameSession" ADD COLUMN     "gameType" TEXT NOT NULL DEFAULT 'mafia',
ADD COLUMN     "settings" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "state" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "Lobby" ADD COLUMN     "settings" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "LobbyPlayer" ADD COLUMN     "number" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "News" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT,
    "size" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sections" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "News_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GamePlayer_gameId_number_key" ON "GamePlayer"("gameId", "number");

-- CreateIndex
CREATE INDEX "GameResult_gameId_idx" ON "GameResult"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "LobbyPlayer_lobbyId_number_key" ON "LobbyPlayer"("lobbyId", "number");

-- AddForeignKey
ALTER TABLE "GamePlayer" ADD CONSTRAINT "GamePlayer_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
