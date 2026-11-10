ALTER TABLE "result_pins"
ADD COLUMN "uses_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "max_uses" INTEGER NOT NULL DEFAULT 5;

CREATE TABLE "result_pin_usages" (
  "id" TEXT NOT NULL,
  "result_pin_id" TEXT NOT NULL,
  "student_id" TEXT NOT NULL,
  "used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "result_pin_usages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "result_pin_usages_result_pin_id_fkey"
    FOREIGN KEY ("result_pin_id") REFERENCES "result_pins"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "result_pin_usages_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "students"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);
