-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "slackMemberMatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "crmUserId" TEXT NOT NULL,
    "slackUserId" TEXT,
    "slackHandle" TEXT,
    "slackEmail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "slackMemberMatch_crmUserId_fkey" FOREIGN KEY ("crmUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "slackChannel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "memberCount" INTEGER,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "isMember" BOOLEAN NOT NULL DEFAULT false,
    "inviteRequestedAt" DATETIME,
    "classifiedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "slackInstallation" (
    "installerId" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "teamName" TEXT,
    "userToken" TEXT,
    "userScopes" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "slackWorkspaceGrant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "teamName" TEXT,
    "userToken" TEXT NOT NULL,
    "userScopes" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "expiresAt" DATETIME NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "activeOrganizationId" TEXT,
    CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" DATETIME,
    "refreshTokenExpiresAt" DATETIME,
    "scope" TEXT,
    "password" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "rateLimit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "lastRequest" BIGINT NOT NULL
);

-- CreateTable
CREATE TABLE "company" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "website" TEXT,
    "description" TEXT,
    "logoUrl" TEXT,
    "logoDarkUrl" TEXT,
    "iconUrl" TEXT,
    "iconDarkUrl" TEXT,
    "iconTone" TEXT,
    "brandColor" TEXT,
    "industry" TEXT,
    "subIndustry" TEXT,
    "city" TEXT,
    "stateCode" TEXT,
    "country" TEXT,
    "countryCode" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "linkedinUrl" TEXT,
    "twitterUrl" TEXT,
    "githubUrl" TEXT,
    "pricingUrl" TEXT,
    "careersUrl" TEXT,
    "ownerId" TEXT,
    "primaryContactId" TEXT,
    "enrichmentStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "enrichedAt" DATETIME,
    "enrichmentError" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "lastActivityAt" DATETIME,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "company_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "company_primaryContactId_fkey" FOREIGN KEY ("primaryContactId") REFERENCES "contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "companyEnrichment" (
    "companyId" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL DEFAULT 'context.dev',
    "raw" JSONB NOT NULL,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "companyEnrichment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "contact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "title" TEXT,
    "seniority" TEXT,
    "function" TEXT,
    "linkedinUrl" TEXT,
    "twitterUrl" TEXT,
    "githubUrl" TEXT,
    "imageUrl" TEXT,
    "socialsCheckedAt" DATETIME,
    "enrichmentStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "enrichedAt" DATETIME,
    "enrichmentError" TEXT,
    "companyId" TEXT,
    "ownerId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "lastActivityAt" DATETIME,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "contact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "contact_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "contactFact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contactId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "score" REAL NOT NULL,
    "band" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "method" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "sessionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "decidedById" TEXT,
    "decidedAt" DATETIME,
    "observedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersededAt" DATETIME,
    CONSTRAINT "contactFact_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "contactFact_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "contactBrief" (
    "contactId" TEXT NOT NULL PRIMARY KEY,
    "narrative" TEXT NOT NULL,
    "sections" JSONB NOT NULL,
    "score" REAL NOT NULL,
    "sourceUrl" TEXT,
    "sessionId" TEXT,
    "refreshedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "contactBrief_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "agentTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contactId" TEXT,
    "companyId" TEXT,
    "dealId" TEXT,
    "kind" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "payload" JSONB,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "budget" INTEGER NOT NULL DEFAULT 4,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "dueAt" DATETIME NOT NULL,
    "leasedUntil" DATETIME,
    "sessionId" TEXT,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "outcome" TEXT,
    "subject" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "agentEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "contactId" TEXT,
    "conversationId" TEXT,
    "type" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "emittedAt" DATETIME NOT NULL,
    CONSTRAINT "agentEvent_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "agentConversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "agentConversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL DEFAULT 'RECORD',
    "contactId" TEXT,
    "companyId" TEXT,
    "dealId" TEXT,
    "userId" TEXT NOT NULL,
    "agentId" TEXT,
    "sessionId" TEXT,
    "continuationToken" TEXT,
    "streamIndex" INTEGER NOT NULL DEFAULT 0,
    "pendingInputRequest" JSONB,
    "title" TEXT,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastMessageAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAssistantAt" DATETIME,
    "lastReadAt" DATETIME,
    CONSTRAINT "agentConversation_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "agentConversation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "agentConversation_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deal" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "agentConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "agentConversation_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agentDefinition" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "agentConversationFeedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "rating" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "agentConversationFeedback_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "agentConversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "agentConversationFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "agentConversationShare" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'WORKSPACE_LINK',
    "tokenHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    "revokedAt" DATETIME,
    CONSTRAINT "agentConversationShare_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "agentConversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "agentConversationShare_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "agentConversationSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "clientRequestId" TEXT NOT NULL,
    "inputRequestId" TEXT,
    "commandType" TEXT NOT NULL DEFAULT 'CHAT',
    "message" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" DATETIME,
    "acceptedAt" DATETIME,
    CONSTRAINT "agentConversationSubmission_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "agentConversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "agentConversationSubmission_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "agentConversationAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "submissionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "content" BLOB NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agentConversationAttachment_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "agentConversationSubmission" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "agentDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "currentVersionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "archivedAt" DATETIME,
    "deletedAt" DATETIME,
    CONSTRAINT "agentDefinition_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "agentDefinition_currentVersionId_id_fkey" FOREIGN KEY ("currentVersionId", "id") REFERENCES "agentVersion" ("id", "agentId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "agentVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "instructions" TEXT NOT NULL,
    "manifest" JSONB NOT NULL,
    "modelId" TEXT NOT NULL,
    "modelContextWindowTokens" INTEGER NOT NULL DEFAULT 1000000,
    "sandboxPolicy" JSONB NOT NULL,
    "validation" JSONB,
    "sourceConversationId" TEXT,
    "createdById" TEXT NOT NULL,
    "deploymentId" TEXT,
    "approvedAt" DATETIME,
    "deployedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agentVersion_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agentDefinition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "agentVersion_sourceConversationId_fkey" FOREIGN KEY ("sourceConversationId") REFERENCES "agentConversation" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "agentVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "agentBuilderArtifact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT,
    "versionId" TEXT,
    "path" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "previousContent" TEXT,
    "revision" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'WRITING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agentBuilderArtifact_owner_present" CHECK ("conversationId" IS NOT NULL OR "versionId" IS NOT NULL),
    CONSTRAINT "agentBuilderArtifact_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "agentConversation" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "agentBuilderArtifact_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "agentVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "agentTrigger" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "nextRunAt" DATETIME,
    "lastRunAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "agentTrigger_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agentDefinition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "agentTrigger_versionId_agentId_fkey" FOREIGN KEY ("versionId", "agentId") REFERENCES "agentVersion" ("id", "agentId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "agentTrigger_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "agentRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "triggerId" TEXT,
    "initiatedById" TEXT,
    "triggerType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "principalId" TEXT,
    "sessionId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "input" JSONB,
    "result" JSONB,
    "summary" TEXT,
    "modelId" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "costUsd" DECIMAL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "nextEventSequence" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "cancelRequestedAt" DATETIME,
    "cancelDeliveredAt" DATETIME,
    CONSTRAINT "agentRun_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agentDefinition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "agentRun_versionId_agentId_fkey" FOREIGN KEY ("versionId", "agentId") REFERENCES "agentVersion" ("id", "agentId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "agentRun_triggerId_agentId_fkey" FOREIGN KEY ("triggerId", "agentId") REFERENCES "agentTrigger" ("id", "agentId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "agentRun_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "agentRunEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "emittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agentRunEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "agentRun" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "agentAction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "targetLabel" TEXT,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT,
    "externalId" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "plannedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "agentAction_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agentDefinition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "agentAction_runId_agentId_fkey" FOREIGN KEY ("runId", "agentId") REFERENCES "agentRun" ("id", "agentId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "agentAuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "versionId" TEXT,
    "actorUserId" TEXT,
    "type" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "summary" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "requestId" TEXT,
    "emittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agentAuditEvent_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agentDefinition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "agentAuditEvent_versionId_agentId_fkey" FOREIGN KEY ("versionId", "agentId") REFERENCES "agentVersion" ("id", "agentId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "agentAuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "deal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "companyId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'DEMO_BOOKED',
    "stageChangedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DECIMAL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "expectedCloseDate" DATETIME,
    "closedAt" DATETIME,
    "closedReason" TEXT,
    "baseAmount" DECIMAL,
    "baseCurrency" TEXT,
    "fxRate" DECIMAL,
    "fxRateAt" DATETIME,
    "lastActivityAt" DATETIME,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "deal_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "deal_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "exchangeRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "baseCurrency" TEXT NOT NULL,
    "quoteCurrency" TEXT NOT NULL,
    "rate" DECIMAL NOT NULL,
    "asOf" DATETIME NOT NULL,
    "source" TEXT NOT NULL,
    "provider" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "dealContact" (
    "dealId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "role" TEXT,

    PRIMARY KEY ("dealId", "contactId"),
    CONSTRAINT "dealContact_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deal" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "dealContact_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "fieldDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entity" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "agentFilled" BOOLEAN NOT NULL DEFAULT true,
    "agentBrief" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "showOnSheet" BOOLEAN NOT NULL DEFAULT true,
    "showOnTable" BOOLEAN NOT NULL DEFAULT false,
    "showOnFilter" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "fieldOption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fieldId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "archivedAt" DATETIME,
    CONSTRAINT "fieldOption_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "fieldDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "fieldValue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fieldId" TEXT NOT NULL,
    "companyId" TEXT,
    "contactId" TEXT,
    "dealId" TEXT,
    "text" TEXT,
    "number" DECIMAL,
    "date" DATETIME,
    "bool" BOOLEAN,
    "optionId" TEXT,
    "userId" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "fieldValue_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "fieldDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "fieldValue_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "fieldValue_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "fieldValue_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deal" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "fieldValue_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "fieldOption" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "fieldValue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "savedView" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entity" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shared" BOOLEAN NOT NULL DEFAULT false,
    "filters" JSONB NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "savedView_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "activity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT,
    "occurredAt" DATETIME,
    "dueAt" DATETIME,
    "completedAt" DATETIME,
    "companyId" TEXT,
    "contactId" TEXT,
    "dealId" TEXT,
    "createdById" TEXT NOT NULL,
    "meta" JSONB,
    "emailThreadId" TEXT,
    "calendarEventId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "activity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "activity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "activity_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deal" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "activity_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "activity_emailThreadId_fkey" FOREIGN KEY ("emailThreadId") REFERENCES "emailThread" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "activity_calendarEventId_fkey" FOREIGN KEY ("calendarEventId") REFERENCES "calendarEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "mailboxSync" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IDLE',
    "cursor" TEXT,
    "lastSyncedAt" DATETIME,
    "lastError" TEXT,
    "retryAfter" DATETIME,
    "autoCreate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "mailboxSync_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "emailThread" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rootMessageId" TEXT NOT NULL,
    "subject" TEXT,
    "companyId" TEXT,
    "contactId" TEXT,
    "firstMessageAt" DATETIME NOT NULL,
    "lastMessageAt" DATETIME NOT NULL,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "emailThread_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "emailThread_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "emailMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "threadId" TEXT NOT NULL,
    "rfcMessageId" TEXT NOT NULL,
    "syncedByUserId" TEXT,
    "gmailMessageId" TEXT,
    "outlookMessageId" TEXT,
    "outlookWebLink" TEXT,
    "direction" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "fromName" TEXT,
    "recipients" JSONB NOT NULL,
    "subject" TEXT,
    "snippet" TEXT,
    "body" TEXT,
    "sentAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "emailMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "emailThread" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "calendarEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "iCalUid" TEXT NOT NULL,
    "originalStartTime" DATETIME NOT NULL,
    "recurringEventId" TEXT,
    "title" TEXT,
    "description" TEXT,
    "location" TEXT,
    "conferenceUrl" TEXT,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "isAllDay" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL,
    "organizerEmail" TEXT,
    "companyId" TEXT,
    "contactId" TEXT,
    "syncedByUserId" TEXT,
    "googleEventId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "calendarEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "calendarEvent_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "calendarAttendee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "responseStatus" TEXT,
    "isOrganizer" BOOLEAN NOT NULL DEFAULT false,
    "contactId" TEXT,
    CONSTRAINT "calendarAttendee_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "calendarEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "calendarAttendee_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "suppressedDomain" (
    "domain" TEXT NOT NULL PRIMARY KEY,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "suppressedContact" (
    "email" TEXT NOT NULL PRIMARY KEY,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "appSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentModelId" TEXT,
    "agentModelContextWindow" INTEGER,
    "contextDevApiKey" TEXT,
    "reportingCurrency" TEXT,
    "ratesRefreshedAt" DATETIME,
    "archiveRetentionDays" INTEGER NOT NULL DEFAULT 180,
    "trackingSiteId" TEXT,
    "trackingCrossDomain" BOOLEAN NOT NULL DEFAULT true,
    "trackingLimitToDomains" BOOLEAN NOT NULL DEFAULT true,
    "trackingCookieSubdomains" BOOLEAN NOT NULL DEFAULT false,
    "trackingSecureCookies" BOOLEAN NOT NULL DEFAULT true,
    "trackingHonourDnt" BOOLEAN NOT NULL DEFAULT true,
    "trackingCookieDays" INTEGER NOT NULL DEFAULT 395,
    "trackingConfigHash" TEXT,
    "trackingPaused" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "trackedDomain" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "host" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'EXACT_HOST',
    "pageViews" INTEGER NOT NULL DEFAULT 0,
    "lastSeenAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "trackedVisitor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contactId" TEXT,
    "firstSource" TEXT,
    "firstMedium" TEXT,
    "firstCampaign" TEXT,
    "firstTerm" TEXT,
    "firstContent" TEXT,
    "firstReferrer" TEXT,
    "firstLanding" TEXT,
    "firstTouchAt" DATETIME,
    "lastSource" TEXT,
    "lastMedium" TEXT,
    "lastCampaign" TEXT,
    "lastTerm" TEXT,
    "lastContent" TEXT,
    "lastReferrer" TEXT,
    "lastLanding" TEXT,
    "lastTouchAt" DATETIME,
    "firstSeen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" DATETIME NOT NULL,
    CONSTRAINT "trackedVisitor_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "trackedEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "visitorId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "referrer" TEXT,
    "label" TEXT,
    "source" TEXT,
    "medium" TEXT,
    "campaign" TEXT,
    "occurredAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "trackingCounter" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "trackedPageDaily" (
    "day" DATETIME NOT NULL,
    "host" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "visitors" INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY ("day", "host", "path")
);

-- CreateTable
CREATE TABLE "formSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "visitorId" TEXT,
    "contactId" TEXT,
    "host" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "email" TEXT,
    "fields" JSONB NOT NULL,
    "firstTouch" JSONB,
    "lastTouch" JSONB,
    "dedupeKey" TEXT NOT NULL,
    "filedAt" DATETIME,
    "skipReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "formSubmission_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "install" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "uuid" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "lastRollupAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

WITH random_uuid(value) AS (
    SELECT lower(hex(randomblob(16)))
)
INSERT INTO "install" ("id", "uuid", "version", "updatedAt")
SELECT
    'install',
    substr(value, 1, 8) || '-' ||
    substr(value, 9, 4) || '-' ||
    '4' || substr(value, 14, 3) || '-' ||
    '8' || substr(value, 18, 3) || '-' ||
    substr(value, 21, 12),
    'unknown',
    CURRENT_TIMESTAMP
FROM random_uuid;

-- CreateTable
CREATE TABLE "telemetryMilestone" (
    "step" TEXT NOT NULL PRIMARY KEY,
    "reachedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "telemetryCounter" (
    "name" TEXT NOT NULL PRIMARY KEY,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "createdAt" DATETIME NOT NULL,
    "metadata" TEXT,
    "website" TEXT
);

-- CreateTable
CREATE TABLE "workspaceProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "website" TEXT NOT NULL,
    "narrative" TEXT NOT NULL,
    "sections" JSONB NOT NULL,
    "sourceUrl" TEXT,
    "sessionId" TEXT,
    "refreshedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "member" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" DATETIME NOT NULL,
    CONSTRAINT "member_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "invitation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inviterId" TEXT NOT NULL,
    CONSTRAINT "invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "invitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ssoProvider" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "issuer" TEXT NOT NULL,
    "oidcConfig" TEXT,
    "samlConfig" TEXT,
    "userId" TEXT,
    "providerId" TEXT NOT NULL,
    "organizationId" TEXT,
    "domain" TEXT NOT NULL,
    CONSTRAINT "ssoProvider_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "apikey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "configId" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT,
    "start" TEXT,
    "referenceId" TEXT NOT NULL,
    "prefix" TEXT,
    "key" TEXT NOT NULL,
    "refillInterval" INTEGER,
    "refillAmount" INTEGER,
    "lastRefillAt" DATETIME,
    "enabled" BOOLEAN DEFAULT true,
    "rateLimitEnabled" BOOLEAN DEFAULT true,
    "rateLimitTimeWindow" INTEGER,
    "rateLimitMax" INTEGER,
    "requestCount" INTEGER DEFAULT 0,
    "remaining" INTEGER,
    "lastRequest" DATETIME,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "permissions" TEXT,
    "metadata" TEXT,
    CONSTRAINT "apikey_referenceId_fkey" FOREIGN KEY ("referenceId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "slackMemberMatch_crmUserId_key" ON "slackMemberMatch"("crmUserId");

-- CreateIndex
CREATE INDEX "slackMemberMatch_slackUserId_idx" ON "slackMemberMatch"("slackUserId");

-- CreateIndex
CREATE INDEX "slackChannel_available_name_idx" ON "slackChannel"("available", "name");

-- CreateIndex
CREATE INDEX "slackChannel_updatedAt_idx" ON "slackChannel"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "slackWorkspaceGrant_teamId_key" ON "slackWorkspaceGrant"("teamId");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "rateLimit_key_key" ON "rateLimit"("key");

-- CreateIndex
CREATE UNIQUE INDEX "company_primaryContactId_key" ON "company"("primaryContactId");

-- CreateIndex
CREATE INDEX "company_ownerId_idx" ON "company"("ownerId");

-- CreateIndex
CREATE INDEX "company_name_idx" ON "company"("name");

-- CreateIndex
CREATE INDEX "company_lastActivityAt_idx" ON "company"("lastActivityAt");

-- CreateIndex
CREATE INDEX "company_archivedAt_idx" ON "company"("archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "company_domain_active_key" ON "company"("domain") WHERE "archivedAt" IS NULL;

-- CreateIndex
CREATE INDEX "contact_companyId_idx" ON "contact"("companyId");

-- CreateIndex
CREATE INDEX "contact_ownerId_idx" ON "contact"("ownerId");

-- CreateIndex
CREATE INDEX "contact_lastActivityAt_idx" ON "contact"("lastActivityAt");

-- CreateIndex
CREATE INDEX "contact_archivedAt_idx" ON "contact"("archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "contact_email_active_key" ON "contact"("email") WHERE "archivedAt" IS NULL;

-- CreateIndex
CREATE INDEX "contactFact_contactId_field_status_idx" ON "contactFact"("contactId", "field", "status");

-- CreateIndex
CREATE INDEX "contactFact_status_observedAt_idx" ON "contactFact"("status", "observedAt");

-- CreateIndex
CREATE INDEX "agentTask_dueAt_leasedUntil_idx" ON "agentTask"("dueAt", "leasedUntil");

-- CreateIndex
CREATE INDEX "agentTask_contactId_idx" ON "agentTask"("contactId");

-- CreateIndex
CREATE INDEX "agentTask_dealId_idx" ON "agentTask"("dealId");

-- CreateIndex
CREATE INDEX "agentTask_kind_subject_idx" ON "agentTask"("kind", "subject") WHERE "finishedAt" IS NULL;

-- CreateIndex
CREATE INDEX "agentEvent_sessionId_emittedAt_idx" ON "agentEvent"("sessionId", "emittedAt");

-- CreateIndex
CREATE INDEX "agentEvent_contactId_emittedAt_idx" ON "agentEvent"("contactId", "emittedAt");

-- CreateIndex
CREATE INDEX "agentEvent_conversationId_emittedAt_idx" ON "agentEvent"("conversationId", "emittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "agentConversation_sessionId_key" ON "agentConversation"("sessionId");

-- CreateIndex
CREATE INDEX "agentConversation_contactId_lastMessageAt_idx" ON "agentConversation"("contactId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "agentConversation_companyId_lastMessageAt_idx" ON "agentConversation"("companyId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "agentConversation_dealId_lastMessageAt_idx" ON "agentConversation"("dealId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "agentConversation_userId_kind_lastMessageAt_idx" ON "agentConversation"("userId", "kind", "lastMessageAt");

-- CreateIndex
CREATE INDEX "agentConversation_agentId_lastMessageAt_idx" ON "agentConversation"("agentId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "agentConversationFeedback_conversationId_createdAt_idx" ON "agentConversationFeedback"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "agentConversationFeedback_conversationId_userId_messageId_key" ON "agentConversationFeedback"("conversationId", "userId", "messageId");

-- CreateIndex
CREATE UNIQUE INDEX "agentConversationShare_tokenHash_key" ON "agentConversationShare"("tokenHash");

-- CreateIndex
CREATE INDEX "agentConversationShare_conversationId_revokedAt_idx" ON "agentConversationShare"("conversationId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "agentConversationShare_one_active_per_conversation" ON "agentConversationShare"("conversationId") WHERE "revokedAt" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "agentConversationSubmission_clientRequestId_key" ON "agentConversationSubmission"("clientRequestId");

-- CreateIndex
CREATE INDEX "agentConversationSubmission_conversationId_createdAt_idx" ON "agentConversationSubmission"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "agentConversationSubmission_status_createdAt_idx" ON "agentConversationSubmission"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "agentConversationSubmission_conversationId_inputRequestId_key" ON "agentConversationSubmission"("conversationId", "inputRequestId");

-- CreateIndex
CREATE INDEX "agentConversationAttachment_submissionId_position_idx" ON "agentConversationAttachment"("submissionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "agentDefinition_currentVersionId_key" ON "agentDefinition"("currentVersionId");

-- CreateIndex
CREATE INDEX "agentDefinition_status_updatedAt_idx" ON "agentDefinition"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "agentDefinition_createdById_createdAt_idx" ON "agentDefinition"("createdById", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "agentDefinition_currentVersionId_id_key" ON "agentDefinition"("currentVersionId", "id");

-- CreateIndex
CREATE INDEX "agentVersion_agentId_createdAt_idx" ON "agentVersion"("agentId", "createdAt");

-- CreateIndex
CREATE INDEX "agentVersion_status_createdAt_idx" ON "agentVersion"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "agentVersion_agentId_number_key" ON "agentVersion"("agentId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "agentVersion_id_agentId_key" ON "agentVersion"("id", "agentId");

-- CreateIndex
CREATE INDEX "agentBuilderArtifact_conversationId_createdAt_idx" ON "agentBuilderArtifact"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "agentBuilderArtifact_versionId_path_idx" ON "agentBuilderArtifact"("versionId", "path");

-- CreateIndex
CREATE UNIQUE INDEX "agentBuilderArtifact_conversation_path_revision_key" ON "agentBuilderArtifact"("conversationId", "path", "revision") WHERE "conversationId" IS NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "agentBuilderArtifact_version_path_revision_key" ON "agentBuilderArtifact"("versionId", "path", "revision") WHERE "versionId" IS NOT NULL;

-- CreateIndex
CREATE INDEX "agentTrigger_agentId_enabled_idx" ON "agentTrigger"("agentId", "enabled");

-- CreateIndex
CREATE INDEX "agentTrigger_enabled_nextRunAt_idx" ON "agentTrigger"("enabled", "nextRunAt");

-- CreateIndex
CREATE INDEX "agentTrigger_versionId_idx" ON "agentTrigger"("versionId");

-- CreateIndex
CREATE UNIQUE INDEX "agentTrigger_id_agentId_key" ON "agentTrigger"("id", "agentId");

-- CreateIndex
CREATE UNIQUE INDEX "agentRun_sessionId_key" ON "agentRun"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "agentRun_idempotencyKey_key" ON "agentRun"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "agentRun_correlationId_key" ON "agentRun"("correlationId");

-- CreateIndex
CREATE INDEX "agentRun_agentId_createdAt_idx" ON "agentRun"("agentId", "createdAt");

-- CreateIndex
CREATE INDEX "agentRun_versionId_createdAt_idx" ON "agentRun"("versionId", "createdAt");

-- CreateIndex
CREATE INDEX "agentRun_status_createdAt_idx" ON "agentRun"("status", "createdAt");

-- CreateIndex
CREATE INDEX "agentRun_triggerId_createdAt_idx" ON "agentRun"("triggerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "agentRun_id_agentId_key" ON "agentRun"("id", "agentId");

-- CreateIndex
CREATE INDEX "agentRunEvent_runId_emittedAt_idx" ON "agentRunEvent"("runId", "emittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "agentRunEvent_runId_sequence_key" ON "agentRunEvent"("runId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "agentAction_idempotencyKey_key" ON "agentAction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "agentAction_agentId_plannedAt_idx" ON "agentAction"("agentId", "plannedAt");

-- CreateIndex
CREATE INDEX "agentAction_runId_plannedAt_idx" ON "agentAction"("runId", "plannedAt");

-- CreateIndex
CREATE INDEX "agentAction_provider_externalId_idx" ON "agentAction"("provider", "externalId");

-- CreateIndex
CREATE INDEX "agentAction_status_plannedAt_idx" ON "agentAction"("status", "plannedAt");

-- CreateIndex
CREATE INDEX "agentAuditEvent_agentId_emittedAt_idx" ON "agentAuditEvent"("agentId", "emittedAt");

-- CreateIndex
CREATE INDEX "agentAuditEvent_versionId_emittedAt_idx" ON "agentAuditEvent"("versionId", "emittedAt");

-- CreateIndex
CREATE INDEX "agentAuditEvent_actorUserId_emittedAt_idx" ON "agentAuditEvent"("actorUserId", "emittedAt");

-- CreateIndex
CREATE INDEX "agentAuditEvent_type_emittedAt_idx" ON "agentAuditEvent"("type", "emittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "agentAuditEvent_agentId_type_requestId_key" ON "agentAuditEvent"("agentId", "type", "requestId");

-- CreateIndex
CREATE INDEX "deal_companyId_idx" ON "deal"("companyId");

-- CreateIndex
CREATE INDEX "deal_ownerId_idx" ON "deal"("ownerId");

-- CreateIndex
CREATE INDEX "deal_stage_idx" ON "deal"("stage");

-- CreateIndex
CREATE INDEX "deal_expectedCloseDate_idx" ON "deal"("expectedCloseDate");

-- CreateIndex
CREATE INDEX "deal_lastActivityAt_idx" ON "deal"("lastActivityAt");

-- CreateIndex
CREATE INDEX "deal_baseAmount_idx" ON "deal"("baseAmount");

-- CreateIndex
CREATE INDEX "deal_currency_idx" ON "deal"("currency");

-- CreateIndex
CREATE INDEX "deal_archivedAt_idx" ON "deal"("archivedAt");

-- CreateIndex
CREATE INDEX "exchangeRate_baseCurrency_quoteCurrency_idx" ON "exchangeRate"("baseCurrency", "quoteCurrency");

-- CreateIndex
CREATE UNIQUE INDEX "exchangeRate_baseCurrency_quoteCurrency_source_key" ON "exchangeRate"("baseCurrency", "quoteCurrency", "source");

-- CreateIndex
CREATE INDEX "dealContact_contactId_idx" ON "dealContact"("contactId");

-- CreateIndex
CREATE INDEX "fieldDefinition_entity_position_idx" ON "fieldDefinition"("entity", "position");

-- CreateIndex
CREATE UNIQUE INDEX "fieldDefinition_entity_key_key" ON "fieldDefinition"("entity", "key");

-- CreateIndex
CREATE INDEX "fieldOption_fieldId_position_idx" ON "fieldOption"("fieldId", "position");

-- CreateIndex
CREATE INDEX "fieldValue_fieldId_text_idx" ON "fieldValue"("fieldId", "text");

-- CreateIndex
CREATE INDEX "fieldValue_fieldId_number_idx" ON "fieldValue"("fieldId", "number");

-- CreateIndex
CREATE INDEX "fieldValue_fieldId_date_idx" ON "fieldValue"("fieldId", "date");

-- CreateIndex
CREATE INDEX "fieldValue_companyId_idx" ON "fieldValue"("companyId");

-- CreateIndex
CREATE INDEX "fieldValue_contactId_idx" ON "fieldValue"("contactId");

-- CreateIndex
CREATE INDEX "fieldValue_dealId_idx" ON "fieldValue"("dealId");

-- CreateIndex
CREATE INDEX "fieldValue_optionId_idx" ON "fieldValue"("optionId");

-- CreateIndex
CREATE INDEX "fieldValue_userId_idx" ON "fieldValue"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "fieldValue_fieldId_companyId_key" ON "fieldValue"("fieldId", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "fieldValue_fieldId_contactId_key" ON "fieldValue"("fieldId", "contactId");

-- CreateIndex
CREATE UNIQUE INDEX "fieldValue_fieldId_dealId_key" ON "fieldValue"("fieldId", "dealId");

-- CreateIndex
CREATE INDEX "savedView_entity_shared_idx" ON "savedView"("entity", "shared");

-- CreateIndex
CREATE UNIQUE INDEX "savedView_entity_ownerId_name_key" ON "savedView"("entity", "ownerId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "activity_emailThreadId_key" ON "activity"("emailThreadId");

-- CreateIndex
CREATE UNIQUE INDEX "activity_calendarEventId_key" ON "activity"("calendarEventId");

-- CreateIndex
CREATE INDEX "activity_companyId_createdAt_idx" ON "activity"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "activity_dealId_createdAt_idx" ON "activity"("dealId", "createdAt");

-- CreateIndex
CREATE INDEX "activity_contactId_createdAt_idx" ON "activity"("contactId", "createdAt");

-- CreateIndex
CREATE INDEX "activity_dueAt_idx" ON "activity"("dueAt");

-- CreateIndex
CREATE INDEX "activity_createdById_idx" ON "activity"("createdById");

-- CreateIndex
CREATE INDEX "mailboxSync_status_idx" ON "mailboxSync"("status");

-- CreateIndex
CREATE UNIQUE INDEX "mailboxSync_userId_source_key" ON "mailboxSync"("userId", "source");

-- CreateIndex
CREATE UNIQUE INDEX "emailThread_rootMessageId_key" ON "emailThread"("rootMessageId");

-- CreateIndex
CREATE INDEX "emailThread_companyId_lastMessageAt_idx" ON "emailThread"("companyId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "emailThread_contactId_lastMessageAt_idx" ON "emailThread"("contactId", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "emailMessage_rfcMessageId_key" ON "emailMessage"("rfcMessageId");

-- CreateIndex
CREATE INDEX "emailMessage_threadId_sentAt_idx" ON "emailMessage"("threadId", "sentAt");

-- CreateIndex
CREATE INDEX "calendarEvent_companyId_startsAt_idx" ON "calendarEvent"("companyId", "startsAt");

-- CreateIndex
CREATE INDEX "calendarEvent_contactId_startsAt_idx" ON "calendarEvent"("contactId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "calendarEvent_iCalUid_originalStartTime_key" ON "calendarEvent"("iCalUid", "originalStartTime");

-- CreateIndex
CREATE INDEX "calendarAttendee_contactId_idx" ON "calendarAttendee"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "calendarAttendee_eventId_email_key" ON "calendarAttendee"("eventId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "appSetting_trackingSiteId_key" ON "appSetting"("trackingSiteId");

-- CreateIndex
CREATE UNIQUE INDEX "trackedDomain_host_key" ON "trackedDomain"("host");

-- CreateIndex
CREATE INDEX "trackedVisitor_contactId_idx" ON "trackedVisitor"("contactId");

-- CreateIndex
CREATE INDEX "trackedVisitor_firstSource_idx" ON "trackedVisitor"("firstSource");

-- CreateIndex
CREATE INDEX "trackedEvent_visitorId_occurredAt_idx" ON "trackedEvent"("visitorId", "occurredAt");

-- CreateIndex
CREATE INDEX "trackedEvent_occurredAt_idx" ON "trackedEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "trackedEvent_host_occurredAt_idx" ON "trackedEvent"("host", "occurredAt");

-- CreateIndex
CREATE INDEX "trackedEvent_source_occurredAt_idx" ON "trackedEvent"("source", "occurredAt");

-- CreateIndex
CREATE INDEX "trackingCounter_expiresAt_idx" ON "trackingCounter"("expiresAt");

-- CreateIndex
CREATE INDEX "trackedPageDaily_host_day_idx" ON "trackedPageDaily"("host", "day");

-- CreateIndex
CREATE UNIQUE INDEX "formSubmission_dedupeKey_key" ON "formSubmission"("dedupeKey");

-- CreateIndex
CREATE INDEX "formSubmission_contactId_idx" ON "formSubmission"("contactId");

-- CreateIndex
CREATE INDEX "formSubmission_createdAt_idx" ON "formSubmission"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "install_uuid_key" ON "install"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "organization_slug_key" ON "organization"("slug");

-- CreateIndex
CREATE INDEX "member_organizationId_idx" ON "member"("organizationId");

-- CreateIndex
CREATE INDEX "member_userId_idx" ON "member"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "member_organizationId_userId_key" ON "member"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "invitation_organizationId_idx" ON "invitation"("organizationId");

-- CreateIndex
CREATE INDEX "invitation_email_idx" ON "invitation"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ssoProvider_providerId_key" ON "ssoProvider"("providerId");

-- CreateIndex
CREATE INDEX "apikey_referenceId_idx" ON "apikey"("referenceId");

-- CreateIndex
CREATE INDEX "apikey_configId_idx" ON "apikey"("configId");

-- CreateIndex
CREATE INDEX "apikey_key_idx" ON "apikey"("key");
