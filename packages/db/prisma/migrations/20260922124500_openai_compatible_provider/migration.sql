ALTER TABLE "appSetting"
ADD COLUMN "aiProviderId" TEXT,
ADD COLUMN "aiProviderRevision" TEXT,
ADD COLUMN "aiProviderBaseUrl" TEXT,
ADD COLUMN "aiProviderApiKey" TEXT,
ADD COLUMN "agentModelMaxOutputTokens" INTEGER;

ALTER TABLE "agentVersion"
ADD COLUMN "modelProviderId" TEXT,
ADD COLUMN "modelMaxOutputTokens" INTEGER;
