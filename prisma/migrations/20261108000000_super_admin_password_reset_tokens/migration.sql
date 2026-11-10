-- CreateTable
CREATE TABLE "super_admin_password_reset_tokens" (
    "id" TEXT NOT NULL,
    "super_admin_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "super_admin_password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "super_admin_password_reset_tokens_token_hash_key" ON "super_admin_password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "super_admin_password_reset_tokens_super_admin_id_idx" ON "super_admin_password_reset_tokens"("super_admin_id");

-- CreateIndex
CREATE INDEX "super_admin_password_reset_tokens_expires_at_idx" ON "super_admin_password_reset_tokens"("expires_at");

-- AddForeignKey
ALTER TABLE "super_admin_password_reset_tokens" ADD CONSTRAINT "super_admin_password_reset_tokens_super_admin_id_fkey" FOREIGN KEY ("super_admin_id") REFERENCES "super_admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

