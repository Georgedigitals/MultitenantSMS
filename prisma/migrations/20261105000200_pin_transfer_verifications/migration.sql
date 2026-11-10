CREATE TABLE "pin_transfer_verifications" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "term_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "sender_name" TEXT NOT NULL,
    "bank_name" TEXT NOT NULL,
    "transaction_ref" TEXT,
    "proof_url" TEXT,
    "status" "PaymentVerificationStatus" NOT NULL DEFAULT 'pending',
    "rejection_reason" TEXT,
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "result_pin_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "pin_transfer_verifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pin_transfer_verifications_result_pin_id_key" ON "pin_transfer_verifications"("result_pin_id");
CREATE UNIQUE INDEX "pin_transfer_verifications_tenant_id_transaction_ref_key" ON "pin_transfer_verifications"("tenant_id", "transaction_ref");
CREATE INDEX "pin_transfer_verifications_tenant_id_status_idx" ON "pin_transfer_verifications"("tenant_id", "status");
CREATE INDEX "pin_transfer_verifications_student_id_term_id_idx" ON "pin_transfer_verifications"("student_id", "term_id");
CREATE UNIQUE INDEX "pin_transfer_verifications_one_pending_per_student_term_key" ON "pin_transfer_verifications"("tenant_id", "student_id", "term_id") WHERE "status" = 'pending';

ALTER TABLE "pin_transfer_verifications" ADD CONSTRAINT "pin_transfer_verifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pin_transfer_verifications" ADD CONSTRAINT "pin_transfer_verifications_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pin_transfer_verifications" ADD CONSTRAINT "pin_transfer_verifications_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "terms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pin_transfer_verifications" ADD CONSTRAINT "pin_transfer_verifications_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pin_transfer_verifications" ADD CONSTRAINT "pin_transfer_verifications_result_pin_id_fkey" FOREIGN KEY ("result_pin_id") REFERENCES "result_pins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
