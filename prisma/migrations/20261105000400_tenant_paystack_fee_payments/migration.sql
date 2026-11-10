CREATE TABLE "tenant_payment_gateways" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "paystack_secret_cipher" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tenant_payment_gateways_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tenant_payment_gateways_tenant_id_key" ON "tenant_payment_gateways"("tenant_id");
ALTER TABLE "tenant_payment_gateways" ADD CONSTRAINT "tenant_payment_gateways_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "payment_intents" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "student_id" TEXT,
    "term_id" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "payer_email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'initializing',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payment_intents_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "payment_intents_reference_key" ON "payment_intents"("reference");
CREATE INDEX "payment_intents_tenant_id_purpose_status_idx" ON "payment_intents"("tenant_id", "purpose", "status");
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
