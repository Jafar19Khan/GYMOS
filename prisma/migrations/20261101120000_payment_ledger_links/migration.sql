ALTER TABLE "payments" ADD COLUMN "relatedPaymentId" UUID;

CREATE INDEX "payments_relatedPaymentId_idx" ON "payments"("relatedPaymentId");

ALTER TABLE "payments" ADD CONSTRAINT "payments_relatedPaymentId_fkey"
  FOREIGN KEY ("relatedPaymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
