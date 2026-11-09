DROP INDEX "apontamentos_obra_idx";--> statement-breakpoint
ALTER TABLE "apontamentos" ADD COLUMN "seq" bigint NOT NULL GENERATED ALWAYS AS IDENTITY (sequence name "apontamentos_seq_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1);--> statement-breakpoint
CREATE INDEX "apontamentos_obra_idx" ON "apontamentos" USING btree ("obra_id","seq");