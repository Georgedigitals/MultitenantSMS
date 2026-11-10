CREATE TABLE "pin_settlements" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "gross_amount" DECIMAL(10,2) NOT NULL,
    "platform_fee_amount" DECIMAL(10,2) NOT NULL,
    "school_net_amount" DECIMAL(10,2) NOT NULL,
    "payout_reference" TEXT NOT NULL,
    "settled_by" TEXT NOT NULL,
    "settled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pin_settlements_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "pin_settlements_tenant_id_payout_reference_key" ON "pin_settlements"("tenant_id", "payout_reference");
CREATE INDEX "pin_settlements_tenant_id_settled_at_idx" ON "pin_settlements"("tenant_id", "settled_at");
ALTER TABLE "pin_settlements" ADD CONSTRAINT "pin_settlements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "result_pins" ADD COLUMN "settlement_id" TEXT;
CREATE INDEX "result_pins_settlement_id_idx" ON "result_pins"("settlement_id");
ALTER TABLE "result_pins" ADD CONSTRAINT "result_pins_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "pin_settlements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
