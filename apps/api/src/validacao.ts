/** Validação de entrada (zod). Espelha packages/shared/src/types.ts. */
import { z } from 'zod';
import { validarPredecessoras } from '@obras/shared';

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data no formato AAAA-MM-DD');
const id = z.string().min(1).max(120);
const reais = z.number().finite().min(0).max(1e12);

export const perfil = z.enum(['diretor', 'engenheiro', 'encarregado']);
export const tipoObra = z.enum(['casa_terrea', 'geminadas', 'sobrado', 'predio_3_6', 'predio_7_mais', 'comercial']);
const tipoPavimento = z.enum(['subsolo_garagem', 'terreo', 'terreo_comercial', 'tipo', 'cobertura', 'casa_maquinas']);

const item = z.object({
  id,
  localId: id,
  inicioPlanejado: data,
  fimPlanejado: data,
  inicioReal: data.optional(),
  fimReal: data.optional(),
  percentual: z.number().min(0).max(100),
  valorOrcado: reais,
});

const atividade = z.object({
  id,
  codigo: z.string().min(1).max(20),
  nome: z.string().min(1).max(300),
  etapaCodigo: z.number().int().min(1).max(99),
  duracaoConfirmada: z.boolean(),
  itens: z.array(item),
});

const etapa = z.object({
  codigo: z.number().int().min(1).max(99),
  nome: z.string().min(1).max(200),
  valorOrcado: reais,
  valorEstimado: z.boolean(),
  predecessoras: z.array(z.number().int().min(1).max(99)).max(30).default([]),
  atividades: z.array(atividade),
});

const local = z.object({
  id,
  nome: z.string().min(1).max(120),
  tipo: z.enum(['obra', 'pavimento', 'unidade']),
  tipoPavimento: tipoPavimento.optional(),
  ordem: z.number().int(),
});

const baseline = z.object({
  versao: z.number().int().min(1),
  congeladaEm: data,
  autorId: id,
  justificativa: z.string().max(2000).optional(),
  itens: z.record(z.string(), z.object({ inicio: data, fim: data, valor: reais })),
});

export const obra = z.object({
  id,
  nome: z.string().trim().min(1).max(200),
  tipo: tipoObra,
  endereco: z.string().max(300),
  cidade: z.string().max(120),
  areaM2: z.number().min(0).max(1e7),
  status: z.enum(['planejamento', 'em_andamento', 'pausada', 'concluida']),
  dataInicio: data,
  orcamentoTotal: reais,
  engenheiroId: id,
  encarregadoId: id,
  locais: z.array(local).min(1),
  etapas: z.array(etapa),
  baselines: z.array(baseline).default([]),
  apontamentos: z.array(z.any()).default([]),
  revisao: z.number().int().optional(),
  exemplo: z.boolean().optional(),
}).superRefine((o, ctx) => {
  for (const m of validarPredecessoras(o.etapas)) ctx.addIssue({ code: 'custom', message: m });
  const locais = new Set(o.locais.map((l) => l.id));
  const itens = new Set<string>();
  for (const e of o.etapas) for (const a of e.atividades) {
    if (a.etapaCodigo !== e.codigo) ctx.addIssue({ code: 'custom', message: `atividade ${a.codigo} fora da etapa ${e.codigo}` });
    for (const i of a.itens) {
      if (!locais.has(i.localId)) ctx.addIssue({ code: 'custom', message: `item ${i.id} com local inexistente` });
      if (itens.has(i.id)) ctx.addIssue({ code: 'custom', message: `item ${i.id} repetido` });
      itens.add(i.id);
      if (i.fimPlanejado < i.inicioPlanejado) ctx.addIssue({ code: 'custom', message: `item ${i.id} termina antes de começar` });
    }
  }
});
export type ObraEntrada = z.infer<typeof obra>;

export const apontamento = z.object({
  itemId: id,
  percentualNovo: z.number().min(0).max(100),
  observacao: z.string().max(2000).optional(),
  fotos: z.array(z.string().max(200)).max(20).optional(),
});

export const novaBaseline = z.object({ justificativa: z.string().trim().max(2000).optional() });
/** Campo extra do PUT /obras/:id: justificativa do save do cronograma (plano 2026-11-11-15-05). */
export const extraGravarObra = z.object({ justificativaAlteracao: z.string().trim().max(2000).optional() });

export const login = z.object({ email: z.string().trim().toLowerCase().email(), senha: z.string().min(1).max(200) });
export const trocaSenha = z.object({ atual: z.string().min(1), nova: z.string().min(8, 'mínimo de 8 caracteres').max(200) });

export const novoUsuario = z.object({
  nome: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  perfil,
  senha: z.string().min(8, 'mínimo de 8 caracteres').max(200),
});
export const edicaoUsuario = z.object({
  nome: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  perfil: perfil.optional(),
  ativo: z.boolean().optional(),
  senha: z.string().min(8, 'mínimo de 8 caracteres').max(200).optional(),
});

const modeloAtividade = z.object({
  codigo: z.string().min(1),
  nome: z.string().min(1),
  etapaCodigo: z.number().int(),
  pesoNaEtapa: z.number().min(0).max(1),
  duracaoDiasUteis: z.number().min(0).max(5000),
  porLocal: z.boolean(),
  tiposPavimento: z.array(tipoPavimento).optional(),
  predecessoras: z.array(z.string()),
  duracaoConfirmada: z.boolean(),
  fonte: z.string().optional(),
  minPavimentos: z.number().int().optional(),
});
export const modelo = z.object({
  tipo: tipoObra,
  nome: z.string().min(1),
  descricao: z.string(),
  desdobramento: z.enum(['nenhum', 'pavimentos', 'unidades']),
  etapasAtivas: z.array(z.number().int()),
  distribuicaoPadrao: z.record(z.string(), z.number()),
  atividades: z.array(modeloAtividade),
});

// ---------------------------------------------------------------------------
// Gastos (financeiro orçado x realizado)
// ---------------------------------------------------------------------------
const dataReal = data.refine((d) => {
  const [a, m, dia] = d.split('-').map(Number);
  const dt = new Date(Date.UTC(a, m - 1, dia));
  return a >= 1900 && a <= 2200 && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === dia;
}, 'data inexistente');
const valorGasto = z.number().finite().gt(0, 'precisa ser maior que zero').max(1e12).transform((n) => Math.round(n * 100) / 100);
/** Texto opcional: vazio ou null = sem valor (null limpa no PATCH). */
const textoOpcional = (max: number) => z.string().trim().max(max).nullable().optional().transform((s) => (s ? s : s === undefined ? undefined : null));
export const categoriaGasto = z.enum(['material', 'mao_de_obra', 'equipamento', 'terceiros', 'outros']);

export const novoGasto = z.object({
  /** Opcional: o web manda o id gerado no navegador (lançamento otimista). */
  id: z.string().regex(/^gasto-[A-Za-z0-9-]{8,80}$/, 'id de gasto inválido').optional(),
  obraId: id.optional(),
  data: dataReal,
  etapaCodigo: z.number().int().min(1).max(99),
  atividadeId: id.nullable().optional(),
  categoria: categoriaGasto,
  valor: valorGasto,
  descricao: z.string().trim().min(1, 'obrigatória').max(200),
  fornecedor: textoOpcional(120),
  documento: textoOpcional(120),
});

export const edicaoGasto = z.object({
  data: dataReal.optional(),
  etapaCodigo: z.number().int().min(1).max(99).optional(),
  atividadeId: id.nullable().optional(),
  categoria: categoriaGasto.optional(),
  valor: valorGasto.optional(),
  descricao: z.string().trim().min(1, 'obrigatória').max(200).optional(),
  fornecedor: textoOpcional(120),
  documento: textoOpcional(120),
});

export const importarGastos = z.object({
  linhas: z.array(z.record(z.string().max(200), z.union([z.string().max(2000), z.number(), z.null()]).transform((x) => (x === null ? '' : String(x))))).max(5000, 'no máximo 5.000 linhas por importação'),
});
