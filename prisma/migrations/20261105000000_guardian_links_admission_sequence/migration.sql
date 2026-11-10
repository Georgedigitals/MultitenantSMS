ALTER TABLE "tenant_users"
ADD COLUMN "guardian_id" TEXT;

CREATE UNIQUE INDEX "tenant_users_guardian_id_key"
ON "tenant_users"("guardian_id");

ALTER TABLE "tenant_users"
ADD CONSTRAINT "tenant_users_guardian_id_fkey"
FOREIGN KEY ("guardian_id") REFERENCES "guardians"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- Preserve guardian accounts already associated through contact_info.userId.
UPDATE "tenant_users" AS u
SET "guardian_id" = (
  SELECT g."id"
  FROM "guardians" AS g
  WHERE g."tenant_id" = u."tenant_id"
    AND g."contact_info"->>'userId' = u."id"
  ORDER BY g."created_at" ASC
  LIMIT 1
)
WHERE u."role" = 'parent'
  AND u."guardian_id" IS NULL
  AND EXISTS (
    SELECT 1 FROM "guardians" AS g
    WHERE g."tenant_id" = u."tenant_id"
      AND g."contact_info"->>'userId' = u."id"
  );

CREATE TABLE "admission_number_counters" (
  "tenant_id" TEXT NOT NULL,
  "prefix" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "last_value" INTEGER NOT NULL,
  CONSTRAINT "admission_number_counters_pkey" PRIMARY KEY ("tenant_id", "prefix", "year"),
  CONSTRAINT "admission_number_counters_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);
