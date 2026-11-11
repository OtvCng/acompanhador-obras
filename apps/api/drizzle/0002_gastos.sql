CREATE TYPE "public"."categoria_gasto" AS ENUM('material', 'mao_de_obra', 'equipamento', 'terceiros', 'outros');--> statement-breakpoint
CREATE TABLE "gastos" (
	"id" text PRIMARY KEY NOT NULL,
	"obra_id" text NOT NULL,
	"data" date NOT NULL,
	"etapa_codigo" integer NOT NULL,
	"atividade_id" text,
	"categoria" "categoria_gasto" NOT NULL,
	"valor" numeric(14, 2) NOT NULL,
	"descricao" text NOT NULL,
	"fornecedor" text,
	"documento" text,
	"autor_id" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"importacao_id" text,
	"exemplo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_obra_id_obras_id_fk" FOREIGN KEY ("obra_id") REFERENCES "public"."obras"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_autor_id_usuarios_id_fk" FOREIGN KEY ("autor_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gastos_obra_idx" ON "gastos" USING btree ("obra_id","data");--> statement-breakpoint
CREATE INDEX "gastos_importacao_idx" ON "gastos" USING btree ("importacao_id");