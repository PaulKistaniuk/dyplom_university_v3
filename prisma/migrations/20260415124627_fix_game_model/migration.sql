/*
  Warnings:

  - You are about to drop the column `state` on the `GameSession` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `GameSession` table. All the data in the column will be lost.
  - You are about to drop the `Player` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `lobbyId` to the `GameSession` table without a default value. This is not possible if the table is not empty.
  - Added the required column `phase` to the `GameSession` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `GameSession` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Player" DROP CONSTRAINT "Player_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "Player" DROP CONSTRAINT "Player_userId_fkey";

-- AlterTable
ALTER TABLE "GameSession" DROP COLUMN "state",
DROP COLUMN "type",
ADD COLUMN     "dayNumber" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "lobbyId" TEXT NOT NULL,
ADD COLUMN     "phase" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Lobby" ADD COLUMN     "lastWords" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "revealRoles" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "Player";

-- CreateTable
CREATE TABLE "GamePlayer" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "isAlive" BOOLEAN NOT NULL DEFAULT true,
    "hasVoted" BOOLEAN NOT NULL DEFAULT false,
    "checksUsed" INTEGER NOT NULL DEFAULT 0,
    "healsUsed" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GamePlayer_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_lobbyId_fkey" FOREIGN KEY ("lobbyId") REFERENCES "Lobby"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamePlayer" ADD CONSTRAINT "GamePlayer_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "GameSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamePlayer" ADD CONSTRAINT "GamePlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
