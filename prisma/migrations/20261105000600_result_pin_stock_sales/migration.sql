ALTER TABLE "pin_batches"
ADD COLUMN "platform_fee_percent" DECIMAL(5,2) NOT NULL DEFAULT 0.00;

ALTER TABLE "tenants"
ADD COLUMN "has_online_pin_payment" BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE "tenants" AS t
SET "has_online_pin_payment" = TRUE
FROM "tenant_payment_gateways" AS g
WHERE g."tenant_id" = t."id" AND g."enabled" = TRUE AND t."has_online_payment" = TRUE;

CREATE UNIQUE INDEX "payment_intents_active_result_pin_student_term_key"
ON "payment_intents"("tenant_id", "student_id", "term_id")
WHERE "purpose" = 'result_pin' AND "status" IN ('initializing', 'initialized');

ALTER TABLE "generated_pins"
ADD COLUMN "online_sale_reference" TEXT,
ADD COLUMN "reserved_until" TIMESTAMP(3),
ADD COLUMN "sold_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "generated_pins_online_sale_reference_key"
ON "generated_pins"("online_sale_reference");

CREATE INDEX "generated_pins_reserved_until_idx"
ON "generated_pins"("reserved_until");

ALTER TABLE "generated_pins"
ADD CONSTRAINT "generated_pins_student_id_fkey"
FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "generated_pins"
ADD CONSTRAINT "generated_pins_term_id_fkey"
FOREIGN KEY ("term_id") REFERENCES "terms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "pin_transfer_verifications"
ADD COLUMN "generated_pin_id" TEXT;

CREATE UNIQUE INDEX "pin_transfer_verifications_generated_pin_id_key"
ON "pin_transfer_verifications"("generated_pin_id");

ALTER TABLE "pin_transfer_verifications"
ADD CONSTRAINT "pin_transfer_verifications_generated_pin_id_fkey"
FOREIGN KEY ("generated_pin_id") REFERENCES "generated_pins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
