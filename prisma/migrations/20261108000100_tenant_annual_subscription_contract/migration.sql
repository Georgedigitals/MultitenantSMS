-- AlterTable
ALTER TABLE "tenants" ADD COLUMN "annual_contract_price" DECIMAL(10,2);
ALTER TABLE "tenants" ADD COLUMN "subscription_started_at" TIMESTAMP(3);
ALTER TABLE "tenants" ADD COLUMN "subscription_expires_at" TIMESTAMP(3);

-- Backfill existing tenants with their current plan price and a 365-day contract term from created_at
UPDATE "tenants" t
SET "annual_contract_price" = p.price,
    "subscription_started_at" = COALESCE(t.created_at, CURRENT_TIMESTAMP),
    "subscription_expires_at" = COALESCE(t.created_at, CURRENT_TIMESTAMP) + INTERVAL '365 days'
FROM "plans" p
WHERE t.plan_id = p.id;

