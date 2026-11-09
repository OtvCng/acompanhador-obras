/**
 * Schema Postgres do Acompanhador de Obras (Drizzle).
 * Espelha os tipos de packages/shared/src/types.ts. Datas em `date` (string ISO, sem fuso), valores em numeric(14,2).
 * Plano: docs/planejamento/2026-11-09-14-47-banco-postgres-api.md
 */
import { sql } from 'drizzle-orm';
import {
  bigint, boolean, date, foreignKey, index, integer, jsonb, numeric, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex,
} from 'drizzle-orm/pg-core';

export const perfilEnum = pgEnum('perfil', ['diretor', 'engenheiro', 'encarregado']);
export const tipoObraEnum = pgEnum('tipo_obra', ['casa_terrea', 'geminadas', 'sobrado', 'predio_3_6', 'predio_7_mais', 'comercial']);
export const statusObraEnum = pgEnum('status_obra', ['planejamento', 'em_andamento', 'pausada', 'concluida']);
export const tipoLocalEnum = pgEnum('tipo_local', ['obra', 'pavimento', 'unidade']);
export const tipoPavimentoEnum = pgEnum('tipo_pavimento', [
  'subsolo_garagem', 'terreo', 'terreo_comercial', 'tipo', 'cobertura', 'casa_maquinas',
]);

const valor = (nome: string) => numeric(nome, { precision: 14, scale: 2, mode: 'number' });
const criadoEm = () => timestamp('criado_em', { withTimezone: true }).notNull().defaultNow();

// ---------------------------------------------------------------------------
// Usuários e sessões
// ---------------------------------------------------------------------------
export const usuarios = pgTable('usuarios', {
  id: text('id').primaryKey(),
  nome: text('nome').notNull(),
  /** Sempre minúsculo. Null = usuário sem login (ex.: usuários fictícios das obras de exemplo). */
  email: text('email'),
  perfil: perfilEnum('perfil').notNull(),
  /** scrypt: "scrypt$N$r$p$salt$hash". Null = não consegue entrar até o diretor definir uma senha. */
  senhaHash: text('senha_hash'),
  ativo: boolean('ativo').notNull().default(true),
  exemplo: boolean('exemplo').notNull().default(false),
  criadoEm: criadoEm(),
}, (t) => [uniqueIndex('usuarios_email_un').on(t.email)]);

export const sessoes = pgTable('sessoes', {
  /** SHA-256 do token do cookie (o token em si nunca é guardado). */
  id: text('id').primaryKey(),
  usuarioId: text('usuario_id').notNull().references(() => usuarios.id, { onDelete: 'cascade' }),
  criadaEm: timestamp('criada_em', { withTimezone: true }).notNull().defaultNow(),
  expiraEm: timestamp('expira_em', { withTimezone: true }).notNull(),
}, (t) => [index('sessoes_usuario_idx').on(t.usuarioId)]);

// ---------------------------------------------------------------------------
// Obras
// ---------------------------------------------------------------------------
export const obras = pgTable('obras', {
  id: text('id').primaryKey(),
  nome: text('nome').notNull(),
  tipo: tipoObraEnum('tipo').notNull(),
  endereco: text('endereco').notNull().default(''),
  cidade: text('cidade').notNull().default(''),
  areaM2: numeric('area_m2', { precision: 12, scale: 2, mode: 'number' }).notNull().default(0),
  status: statusObraEnum('status').notNull().default('planejamento'),
  dataInicio: date('data_inicio').notNull(),
  orcamentoTotal: valor('orcamento_total').notNull(),
  engenheiroId: text('engenheiro_id').notNull().references(() => usuarios.id),
  encarregadoId: text('encarregado_id').notNull().references(() => usuarios.id),
  /** true = obra de demonstração; "Restaurar dados de exemplo" só apaga estas. */
  exemplo: boolean('exemplo').notNull().default(false),
  /** Trava otimista: sobe a cada gravação; PUT com revisão antiga recebe 409. */
  revisao: integer('revisao').notNull().default(1),
  criadoEm: criadoEm(),
  atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('obras_engenheiro_idx').on(t.engenheiroId), index('obras_encarregado_idx').on(t.encarregadoId)]);

export const locais = pgTable('locais', {
  id: text('id').primaryKey(),
  obraId: text('obra_id').notNull().references(() => obras.id, { onDelete: 'cascade' }),
  nome: text('nome').notNull(),
  tipo: tipoLocalEnum('tipo').notNull(),
  tipoPavimento: tipoPavimentoEnum('tipo_pavimento'),
  ordem: integer('ordem').notNull(),
}, (t) => [index('locais_obra_idx').on(t.obraId)]);

export const etapasObra = pgTable('etapas_obra', {
  obraId: text('obra_id').notNull().references(() => obras.id, { onDelete: 'cascade' }),
  codigo: integer('codigo').notNull(),
  nome: text('nome').notNull(),
  valorOrcado: valor('valor_orcado').notNull(),
  valorEstimado: boolean('valor_estimado').notNull().default(true),
}, (t) => [primaryKey({ columns: [t.obraId, t.codigo] })]);

export const atividades = pgTable('atividades', {
  id: text('id').primaryKey(),
  obraId: text('obra_id').notNull(),
  etapaCodigo: integer('etapa_codigo').notNull(),
  codigo: text('codigo').notNull(),
  nome: text('nome').notNull(),
  duracaoConfirmada: boolean('duracao_confirmada').notNull().default(false),
  ordem: integer('ordem').notNull(),
}, (t) => [
  foreignKey({ columns: [t.obraId, t.etapaCodigo], foreignColumns: [etapasObra.obraId, etapasObra.codigo] }).onDelete('cascade'),
  index('atividades_obra_idx').on(t.obraId),
]);

export const itensAtividade = pgTable('itens_atividade', {
  id: text('id').primaryKey(),
  atividadeId: text('atividade_id').notNull().references(() => atividades.id, { onDelete: 'cascade' }),
  obraId: text('obra_id').notNull().references(() => obras.id, { onDelete: 'cascade' }),
  localId: text('local_id').notNull().references(() => locais.id, { onDelete: 'cascade' }),
  inicioPlanejado: date('inicio_planejado').notNull(),
  fimPlanejado: date('fim_planejado').notNull(),
  inicioReal: date('inicio_real'),
  fimReal: date('fim_real'),
  percentual: integer('percentual').notNull().default(0),
  valorOrcado: valor('valor_orcado').notNull(),
  ordem: integer('ordem').notNull(),
}, (t) => [index('itens_obra_idx').on(t.obraId), index('itens_atividade_idx').on(t.atividadeId)]);

// ---------------------------------------------------------------------------
// Baselines e apontamentos
// ---------------------------------------------------------------------------
export const baselines = pgTable('baselines', {
  obraId: text('obra_id').notNull().references(() => obras.id, { onDelete: 'cascade' }),
  versao: integer('versao').notNull(),
  congeladaEm: date('congelada_em').notNull(),
  autorId: text('autor_id').notNull().references(() => usuarios.id),
  justificativa: text('justificativa'),
}, (t) => [primaryKey({ columns: [t.obraId, t.versao] })]);

/** Foto de cada item no congelamento. Sem FK para itens_atividade: a baseline é histórica e sobrevive a um item removido. */
export const baselineItens = pgTable('baseline_itens', {
  obraId: text('obra_id').notNull(),
  versao: integer('versao').notNull(),
  itemId: text('item_id').notNull(),
  inicio: date('inicio').notNull(),
  fim: date('fim').notNull(),
  valor: valor('valor').notNull(),
}, (t) => [
  primaryKey({ columns: [t.obraId, t.versao, t.itemId] }),
  foreignKey({ columns: [t.obraId, t.versao], foreignColumns: [baselines.obraId, baselines.versao] }).onDelete('cascade'),
]);

/** Histórico só cresce. Sem FK para o item, pelo mesmo motivo da baseline. */
export const apontamentos = pgTable('apontamentos', {
  id: text('id').primaryKey(),
  obraId: text('obra_id').notNull().references(() => obras.id, { onDelete: 'cascade' }),
  itemId: text('item_id').notNull(),
  data: date('data').notNull(),
  percentualAnterior: integer('percentual_anterior').notNull(),
  percentualNovo: integer('percentual_novo').notNull(),
  observacao: text('observacao'),
  fotos: text('fotos').array().notNull().default(sql`'{}'::text[]`),
  autorId: text('autor_id').notNull().references(() => usuarios.id),
  criadoEm: criadoEm(),
  /** Ordem de lançamento (o histórico é lido nesta ordem). */
  seq: bigint('seq', { mode: 'number' }).generatedAlwaysAsIdentity(),
}, (t) => [index('apontamentos_obra_idx').on(t.obraId, t.seq)]);

// ---------------------------------------------------------------------------
// Modelos editados (sem linha = modelo padrão do código, MODELOS do shared)
// ---------------------------------------------------------------------------
export const modelos = pgTable('modelos', {
  tipo: tipoObraEnum('tipo').primaryKey(),
  dados: jsonb('dados').notNull(),
  atualizadoPor: text('atualizado_por').references(() => usuarios.id),
  atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
});
