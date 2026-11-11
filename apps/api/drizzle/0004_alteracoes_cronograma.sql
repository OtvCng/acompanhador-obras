CREATE TABLE "alteracoes_cronograma" (
	"id" text PRIMARY KEY NOT NULL,
	"obra_id" text NOT NULL,
	"data" date NOT NULL,
	"autor_id" text NOT NULL,
	"justificativa" text NOT NULL,
	"itens" jsonb NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alteracoes_cronograma" ADD CONSTRAINT "alteracoes_cronograma_obra_id_obras_id_fk" FOREIGN KEY ("obra_id") REFERENCES "public"."obras"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alteracoes_cronograma" ADD CONSTRAINT "alteracoes_cronograma_autor_id_usuarios_id_fk" FOREIGN KEY ("autor_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alteracoes_cronograma_obra_idx" ON "alteracoes_cronograma" USING btree ("obra_id","criado_em");