-- Persisted connections are shared across the organization. The API key is encrypted by
-- the application before it reaches this column; it is never returned in API responses.
CREATE TABLE "EasypanelServer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "panelUrl" TEXT NOT NULL,
    "apiUrl" TEXT NOT NULL,
    "apiKeyCiphertext" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EasypanelServer_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EasypanelServer_apiUrl_key" ON "EasypanelServer"("apiUrl");
