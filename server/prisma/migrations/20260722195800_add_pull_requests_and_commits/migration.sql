-- CreateTable
CREATE TABLE "PullRequest" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "githubPrId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "authorLogin" TEXT NOT NULL,
    "authorAvatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "mergedAt" TIMESTAMP(3),
    "additions" INTEGER NOT NULL DEFAULT 0,
    "deletions" INTEGER NOT NULL DEFAULT 0,
    "changedFiles" INTEGER NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PullRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commit" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "sha" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "authorLogin" TEXT,
    "authorEmail" TEXT,
    "committedAt" TIMESTAMP(3) NOT NULL,
    "additions" INTEGER NOT NULL DEFAULT 0,
    "deletions" INTEGER NOT NULL DEFAULT 0,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Commit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PullRequest_repositoryId_createdAt_idx" ON "PullRequest"("repositoryId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PullRequest_repositoryId_githubPrId_key" ON "PullRequest"("repositoryId", "githubPrId");

-- CreateIndex
CREATE UNIQUE INDEX "Commit_sha_key" ON "Commit"("sha");

-- CreateIndex
CREATE INDEX "Commit_repositoryId_committedAt_idx" ON "Commit"("repositoryId", "committedAt");

-- CreateIndex
CREATE INDEX "SyncJob_repositoryId_status_idx" ON "SyncJob"("repositoryId", "status");

-- AddForeignKey
ALTER TABLE "PullRequest" ADD CONSTRAINT "PullRequest_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commit" ADD CONSTRAINT "Commit_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;
