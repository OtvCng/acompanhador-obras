CREATE TYPE "public"."perfil" AS ENUM('diretor', 'engenheiro', 'encarregado');--> statement-breakpoint
CREATE TYPE "public"."status_obra" AS ENUM('planejamento', 'em_andamento', 'pausada', 'concluida');--> statement-breakpoint
CREATE TYPE "public"."tipo_local" AS ENUM('obra', 'pavimento', 'unidade');--> statement-breakpoint
CREATE TYPE "public"."tipo_obra" AS ENUM('casa_terrea', 'geminadas', 'sobrado', 'predio_3_6', 'predio_7_mais', 'comercial');--> statement-breakpoint
CREATE TYPE "public"."tipo_pavimento" AS ENUM('subsolo_garagem', 'terreo', 'terreo_comercial', 'tipo', 'cobertura', 'casa_maquinas');--> statement-breakpoint
CREATE TABLE "apontamentos" (
	"id" text PRIMARY KEY NOT NULL,
	"obra_id" text NOT NULL,
	"item_id" text NOT NULL,
	"data" date NOT NULL,
	"percentual_anterior" integer NOT NULL,
	"percentual_novo" integer NOT NULL,
	"observacao" text,
	"fotos" text[] DEFAULT '{}'::text[] NOT NULL,
	"autor_id" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "atividades" (
	"id" text PRIMARY KEY NOT NULL,
	"obra_id" text NOT NULL,
	"etapa_codigo" integer NOT NULL,
	"codigo" text NOT NULL,
	"nome" text NOT NULL,
	"duracao_confirmada" boolean DEFAULT false NOT NULL,
	"ordem" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "baseline_itens" (
	"obra_id" text NOT NULL,
	"versao" integer NOT NULL,
	"item_id" text NOT NULL,
	"inicio" date NOT NULL,
	"fim" date NOT NULL,
	"valor" numeric(14, 2) NOT NULL,
	CONSTRAINT "baseline_itens_obra_id_versao_item_id_pk" PRIMARY KEY("obra_id","versao","item_id")
);
--> statement-breakpoint
CREATE TABLE "baselines" (
	"obra_id" text NOT NULL,
	"versao" integer NOT NULL,
	"congelada_em" date NOT NULL,
	"autor_id" text NOT NULL,
	"justificativa" text,
	CONSTRAINT "baselines_obra_id_versao_pk" PRIMARY KEY("obra_id","versao")
);
--> statement-breakpoint
CREATE TABLE "etapas_obra" (
	"obra_id" text NOT NULL,
	"codigo" integer NOT NULL,
	"nome" text NOT NULL,
	"valor_orcado" numeric(14, 2) NOT NULL,
	"valor_estimado" boolean DEFAULT true NOT NULL,
	CONSTRAINT "etapas_obra_obra_id_codigo_pk" PRIMARY KEY("obra_id","codigo")
);
--> statement-breakpoint
CREATE TABLE "itens_atividade" (
	"id" text PRIMARY KEY NOT NULL,
	"atividade_id" text NOT NULL,
	"obra_id" text NOT NULL,
	"local_id" text NOT NULL,
	"inicio_planejado" date NOT NULL,
	"fim_planejado" date NOT NULL,
	"inicio_real" date,
	"fim_real" date,
	"percentual" integer DEFAULT 0 NOT NULL,
	"valor_orcado" numeric(14, 2) NOT NULL,
	"ordem" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locais" (
	"id" text PRIMARY KEY NOT NULL,
	"obra_id" text NOT NULL,
	"nome" text NOT NULL,
	"tipo" "tipo_local" NOT NULL,
	"tipo_pavimento" "tipo_pavimento",
	"ordem" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modelos" (
	"tipo" "tipo_obra" PRIMARY KEY NOT NULL,
	"dados" jsonb NOT NULL,
	"atualizado_por" text,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "obras" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"tipo" "tipo_obra" NOT NULL,
	"endereco" text DEFAULT '' NOT NULL,
	"cidade" text DEFAULT '' NOT NULL,
	"area_m2" numeric(12, 2) DEFAULT 0 NOT NULL,
	"status" "status_obra" DEFAULT 'planejamento' NOT NULL,
	"data_inicio" date NOT NULL,
	"orcamento_total" numeric(14, 2) NOT NULL,
	"engenheiro_id" text NOT NULL,
	"encarregado_id" text NOT NULL,
	"exemplo" boolean DEFAULT false NOT NULL,
	"revisao" integer DEFAULT 1 NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessoes" (
	"id" text PRIMARY KEY NOT NULL,
	"usuario_id" text NOT NULL,
	"criada_em" timestamp with time zone DEFAULT now() NOT NULL,
	"expira_em" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"email" text,
	"perfil" "perfil" NOT NULL,
	"senha_hash" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"exemplo" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "apontamentos" ADD CONSTRAINT "apontamentos_obra_id_obras_id_fk" FOREIGN KEY ("obra_id") REFERENCES "public"."obras"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apontamentos" ADD CONSTRAINT "apontamentos_autor_id_usuarios_id_fk" FOREIGN KEY ("autor_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atividades" ADD CONSTRAINT "atividades_obra_id_etapa_codigo_etapas_obra_obra_id_codigo_fk" FOREIGN KEY ("obra_id","etapa_codigo") REFERENCES "public"."etapas_obra"("obra_id","codigo") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseline_itens" ADD CONSTRAINT "baseline_itens_obra_id_versao_baselines_obra_id_versao_fk" FOREIGN KEY ("obra_id","versao") REFERENCES "public"."baselines"("obra_id","versao") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baselines" ADD CONSTRAINT "baselines_obra_id_obras_id_fk" FOREIGN KEY ("obra_id") REFERENCES "public"."obras"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baselines" ADD CONSTRAINT "baselines_autor_id_usuarios_id_fk" FOREIGN KEY ("autor_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "etapas_obra" ADD CONSTRAINT "etapas_obra_obra_id_obras_id_fk" FOREIGN KEY ("obra_id") REFERENCES "public"."obras"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itens_atividade" ADD CONSTRAINT "itens_atividade_atividade_id_atividades_id_fk" FOREIGN KEY ("atividade_id") REFERENCES "public"."atividades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itens_atividade" ADD CONSTRAINT "itens_atividade_obra_id_obras_id_fk" FOREIGN KEY ("obra_id") REFERENCES "public"."obras"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itens_atividade" ADD CONSTRAINT "itens_atividade_local_id_locais_id_fk" FOREIGN KEY ("local_id") REFERENCES "public"."locais"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locais" ADD CONSTRAINT "locais_obra_id_obras_id_fk" FOREIGN KEY ("obra_id") REFERENCES "public"."obras"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modelos" ADD CONSTRAINT "modelos_atualizado_por_usuarios_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "obras" ADD CONSTRAINT "obras_engenheiro_id_usuarios_id_fk" FOREIGN KEY ("engenheiro_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "obras" ADD CONSTRAINT "obras_encarregado_id_usuarios_id_fk" FOREIGN KEY ("encarregado_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessoes" ADD CONSTRAINT "sessoes_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "apontamentos_obra_idx" ON "apontamentos" USING btree ("obra_id","data");--> statement-breakpoint
CREATE INDEX "atividades_obra_idx" ON "atividades" USING btree ("obra_id");--> statement-breakpoint
CREATE INDEX "itens_obra_idx" ON "itens_atividade" USING btree ("obra_id");--> statement-breakpoint
CREATE INDEX "itens_atividade_idx" ON "itens_atividade" USING btree ("atividade_id");--> statement-breakpoint
CREATE INDEX "locais_obra_idx" ON "locais" USING btree ("obra_id");--> statement-breakpoint
CREATE INDEX "obras_engenheiro_idx" ON "obras" USING btree ("engenheiro_id");--> statement-breakpoint
CREATE INDEX "obras_encarregado_idx" ON "obras" USING btree ("encarregado_id");--> statement-breakpoint
CREATE INDEX "sessoes_usuario_idx" ON "sessoes" USING btree ("usuario_id");--> statement-breakpoint
CREATE UNIQUE INDEX "usuarios_email_un" ON "usuarios" USING btree ("email");