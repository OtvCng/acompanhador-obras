/**
 * Ponte entre o objeto Obra (contrato do shared) e as tabelas normalizadas.
 * Carrega em lote (uma consulta por tabela) e grava a estrutura numa transação.
 */
import { and, asc, eq, inArray } from 'drizzle-orm';
import type { AlteracaoCronograma, Apontamento, Baseline, DesvioCronograma, EtapaObra, Gasto, Obra } from '@obras/shared';
import { db, schema as s, type Db, type Tx } from '../db';

type Exec = Db | Tx;

const semNull = <T extends Record<string, unknown>>(o: T): T => {
  for (const k of Object.keys(o)) if (o[k] === null) delete o[k];
  return o;
};

/** Carrega as obras com tudo dentro. `ids` vazio/undefined = todas. Mantém a ordem de criação. */
export async function carregarObras(ids?: string[], x: Exec = db): Promise<Obra[]> {
  if (ids && ids.length === 0) return [];
  const filtroObra = ids ? inArray(s.obras.id, ids) : undefined;
  const linhas = await x.select().from(s.obras).where(filtroObra).orderBy(asc(s.obras.criadoEm), asc(s.obras.id));
  if (linhas.length === 0) return [];
  const obraIds = linhas.map((o) => o.id);

  // Em sequência (não Promise.all): dentro de uma transação todas usam a mesma conexão.
  const locais = await x.select().from(s.locais).where(inArray(s.locais.obraId, obraIds)).orderBy(asc(s.locais.ordem));
  const etapas = await x.select().from(s.etapasObra).where(inArray(s.etapasObra.obraId, obraIds)).orderBy(asc(s.etapasObra.codigo));
  const atividades = await x.select().from(s.atividades).where(inArray(s.atividades.obraId, obraIds)).orderBy(asc(s.atividades.ordem));
  const itens = await x.select().from(s.itensAtividade).where(inArray(s.itensAtividade.obraId, obraIds)).orderBy(asc(s.itensAtividade.ordem));
  const baselines = await x.select().from(s.baselines).where(inArray(s.baselines.obraId, obraIds)).orderBy(asc(s.baselines.versao));
  const bItens = await x.select().from(s.baselineItens).where(inArray(s.baselineItens.obraId, obraIds));
  const aps = await x.select().from(s.apontamentos).where(inArray(s.apontamentos.obraId, obraIds)).orderBy(asc(s.apontamentos.seq));
  const gs = await x.select().from(s.gastos).where(inArray(s.gastos.obraId, obraIds)).orderBy(asc(s.gastos.data), asc(s.gastos.criadoEm), asc(s.gastos.id));
  const gastosPorObra = agrupar(gs, (g) => g.obraId);
  const alts = await x.select().from(s.alteracoesCronograma).where(inArray(s.alteracoesCronograma.obraId, obraIds)).orderBy(asc(s.alteracoesCronograma.criadoEm));
  const altsPorObra = agrupar(alts, (a) => a.obraId);

  const itensPorAtividade = agrupar(itens, (i) => i.atividadeId);
  const atividadesPorEtapa = agrupar(atividades, (a) => `${a.obraId}|${a.etapaCodigo}`);
  const bItensPorVersao = agrupar(bItens, (b) => `${b.obraId}|${b.versao}`);

  return linhas.map((o): Obra => ({
    id: o.id,
    nome: o.nome,
    tipo: o.tipo,
    endereco: o.endereco,
    cidade: o.cidade,
    areaM2: o.areaM2,
    status: o.status,
    dataInicio: o.dataInicio,
    orcamentoTotal: o.orcamentoTotal,
    engenheiroId: o.engenheiroId,
    encarregadoId: o.encarregadoId,
    revisao: o.revisao,
    exemplo: o.exemplo,
    locais: locais.filter((l) => l.obraId === o.id).map((l) => semNull({
      id: l.id, nome: l.nome, tipo: l.tipo, tipoPavimento: l.tipoPavimento as never, ordem: l.ordem,
    })),
    etapas: etapas.filter((e) => e.obraId === o.id).map((e): EtapaObra => ({
      codigo: e.codigo,
      nome: e.nome,
      valorOrcado: e.valorOrcado,
      valorEstimado: e.valorEstimado,
      predecessoras: e.predecessoras ?? [],
      atividades: (atividadesPorEtapa.get(`${o.id}|${e.codigo}`) ?? []).map((a) => ({
        id: a.id,
        codigo: a.codigo,
        nome: a.nome,
        etapaCodigo: a.etapaCodigo,
        duracaoConfirmada: a.duracaoConfirmada,
        itens: (itensPorAtividade.get(a.id) ?? []).map((i) => semNull({
          id: i.id, localId: i.localId, inicioPlanejado: i.inicioPlanejado, fimPlanejado: i.fimPlanejado,
          inicioReal: i.inicioReal as string | undefined, fimReal: i.fimReal as string | undefined,
          percentual: i.percentual, valorOrcado: i.valorOrcado,
        })),
      })),
    })),
    baselines: baselines.filter((b) => b.obraId === o.id).map((b): Baseline => semNull({
      versao: b.versao,
      congeladaEm: b.congeladaEm,
      autorId: b.autorId,
      justificativa: b.justificativa as string | undefined,
      itens: Object.fromEntries((bItensPorVersao.get(`${o.id}|${b.versao}`) ?? []).map((bi) => [bi.itemId, { inicio: bi.inicio, fim: bi.fim, valor: bi.valor }])),
    })),
    apontamentos: aps.filter((a) => a.obraId === o.id).map((a): Apontamento => semNull({
      id: a.id, itemId: a.itemId, data: a.data, percentualAnterior: a.percentualAnterior, percentualNovo: a.percentualNovo,
      observacao: a.observacao as string | undefined, fotos: a.fotos, autorId: a.autorId,
    })),
    gastos: (gastosPorObra.get(o.id) ?? []).map(gastoDaLinha),
    alteracoes: (altsPorObra.get(o.id) ?? []).map((a): AlteracaoCronograma => ({
      id: a.id, data: a.data, autorId: a.autorId, justificativa: a.justificativa, itens: a.itens as DesvioCronograma[],
    })),
  }));
}

/** Linha da tabela gastos -> Gasto do contrato (sem campos null). */
export function gastoDaLinha(g: typeof s.gastos.$inferSelect): Gasto {
  return semNull({
    id: g.id, obraId: g.obraId, data: g.data, etapaCodigo: g.etapaCodigo, atividadeId: g.atividadeId as string | undefined,
    categoria: g.categoria, valor: g.valor, descricao: g.descricao, fornecedor: g.fornecedor as string | undefined,
    documento: g.documento as string | undefined, autorId: g.autorId, criadoEm: g.criadoEm.toISOString(),
    importacaoId: g.importacaoId as string | undefined, exemplo: g.exemplo || undefined,
  });
}

/** Gasto do contrato -> linha para inserir. */
export function linhaDoGasto(g: Gasto, exemplo = false): typeof s.gastos.$inferInsert {
  return {
    id: g.id, obraId: g.obraId, data: g.data, etapaCodigo: g.etapaCodigo, atividadeId: g.atividadeId ?? null, categoria: g.categoria,
    valor: g.valor, descricao: g.descricao, fornecedor: g.fornecedor ?? null, documento: g.documento ?? null, autorId: g.autorId,
    criadoEm: new Date(g.criadoEm), importacaoId: g.importacaoId ?? null, exemplo,
  };
}

export async function inserirGastos(x: Exec, gastos: Gasto[], exemplo = false) {
  await emLotes(gastos.map((g) => linhaDoGasto(g, exemplo)), (v) => x.insert(s.gastos).values(v));
}

export async function carregarObra(id: string, x: Exec = db): Promise<Obra | undefined> {
  return (await carregarObras([id], x))[0];
}

/** Trava a linha da obra até o fim da transação (evita dois apontamentos se atropelarem). */
export async function travarObra(tx: Tx, id: string) {
  const [o] = await tx.select({ id: s.obras.id, revisao: s.obras.revisao }).from(s.obras).where(eq(s.obras.id, id)).for('update');
  return o;
}

/**
 * Grava a obra inteira: linha da obra + locais/etapas/atividades/itens (apaga e reinsere com os mesmos IDs).
 * Apontamentos e baselines só são gravados se pedidos (criação e carga de exemplos);
 * no PUT eles ficam como estão no banco.
 */
export async function gravarObra(tx: Tx, obra: Obra, opcoes: { nova: boolean; exemplo?: boolean; comHistorico?: boolean }) {
  const linha = {
    nome: obra.nome, tipo: obra.tipo, endereco: obra.endereco, cidade: obra.cidade, areaM2: obra.areaM2,
    status: obra.status, dataInicio: obra.dataInicio, orcamentoTotal: obra.orcamentoTotal,
    engenheiroId: obra.engenheiroId, encarregadoId: obra.encarregadoId, atualizadoEm: new Date(),
  };
  if (opcoes.nova) {
    await tx.insert(s.obras).values({ id: obra.id, ...linha, exemplo: opcoes.exemplo ?? false, revisao: 1 });
  } else {
    await tx.update(s.obras).set({ ...linha, revisao: (obra.revisao ?? 0) + 1 }).where(eq(s.obras.id, obra.id));
    // Apaga a estrutura (cascata: etapas -> atividades -> itens; locais -> itens) e reinsere.
    await tx.delete(s.etapasObra).where(eq(s.etapasObra.obraId, obra.id));
    await tx.delete(s.locais).where(eq(s.locais.obraId, obra.id));
  }

  await emLotes(obra.locais.map((l) => ({ id: l.id, obraId: obra.id, nome: l.nome, tipo: l.tipo, tipoPavimento: l.tipoPavimento ?? null, ordem: l.ordem })),
    (v) => tx.insert(s.locais).values(v));
  await emLotes(obra.etapas.map((e) => ({ obraId: obra.id, codigo: e.codigo, nome: e.nome, valorOrcado: e.valorOrcado, valorEstimado: e.valorEstimado, predecessoras: e.predecessoras ?? [] })),
    (v) => tx.insert(s.etapasObra).values(v));
  let ordemAt = 0, ordemIt = 0;
  const ats: (typeof s.atividades.$inferInsert)[] = [];
  const its: (typeof s.itensAtividade.$inferInsert)[] = [];
  for (const e of obra.etapas) for (const a of e.atividades) {
    ats.push({ id: a.id, obraId: obra.id, etapaCodigo: e.codigo, codigo: a.codigo, nome: a.nome, duracaoConfirmada: a.duracaoConfirmada, ordem: ordemAt++ });
    for (const i of a.itens) {
      its.push({
        id: i.id, atividadeId: a.id, obraId: obra.id, localId: i.localId, inicioPlanejado: i.inicioPlanejado, fimPlanejado: i.fimPlanejado,
        inicioReal: i.inicioReal ?? null, fimReal: i.fimReal ?? null, percentual: Math.round(i.percentual), valorOrcado: i.valorOrcado, ordem: ordemIt++,
      });
    }
  }
  await emLotes(ats, (v) => tx.insert(s.atividades).values(v));
  await emLotes(its, (v) => tx.insert(s.itensAtividade).values(v));

  if (opcoes.comHistorico) {
    for (const b of obra.baselines) await inserirBaseline(tx, obra.id, b);
    await emLotes(obra.apontamentos.map((a) => ({
      id: a.id, obraId: obra.id, itemId: a.itemId, data: a.data, percentualAnterior: a.percentualAnterior, percentualNovo: a.percentualNovo,
      observacao: a.observacao ?? null, fotos: a.fotos ?? [], autorId: a.autorId,
    })), (v) => tx.insert(s.apontamentos).values(v));
    for (const al of obra.alteracoes ?? []) await inserirAlteracao(tx, obra.id, al);
  }
}

export async function inserirBaseline(tx: Tx, obraId: string, b: Baseline) {
  await tx.insert(s.baselines).values({ obraId, versao: b.versao, congeladaEm: b.congeladaEm, autorId: b.autorId, justificativa: b.justificativa ?? null });
  await emLotes(Object.entries(b.itens).map(([itemId, v]) => ({ obraId, versao: b.versao, itemId, inicio: v.inicio, fim: v.fim, valor: v.valor })),
    (v) => tx.insert(s.baselineItens).values(v));
}

export async function inserirAlteracao(tx: Tx, obraId: string, a: AlteracaoCronograma) {
  await tx.insert(s.alteracoesCronograma).values({ id: a.id, obraId, data: a.data, autorId: a.autorId, justificativa: a.justificativa, itens: a.itens });
}

/** Grava só o que um apontamento muda: o item, o status da obra e o registro do apontamento. */
export async function gravarApontamento(tx: Tx, obra: Obra, a: Apontamento) {
  const item = obra.etapas.flatMap((e) => e.atividades.flatMap((at) => at.itens)).find((i) => i.id === a.itemId)!;
  await tx.update(s.itensAtividade)
    .set({ percentual: item.percentual, inicioReal: item.inicioReal ?? null, fimReal: item.fimReal ?? null })
    .where(and(eq(s.itensAtividade.id, item.id), eq(s.itensAtividade.obraId, obra.id)));
  await tx.insert(s.apontamentos).values({
    id: a.id, obraId: obra.id, itemId: a.itemId, data: a.data, percentualAnterior: a.percentualAnterior, percentualNovo: a.percentualNovo,
    observacao: a.observacao ?? null, fotos: a.fotos ?? [], autorId: a.autorId,
  });
  await tx.update(s.obras).set({ status: obra.status, revisao: (obra.revisao ?? 0) + 1, atualizadoEm: new Date() }).where(eq(s.obras.id, obra.id));
}

// ---------------------------------------------------------------------------
function agrupar<T>(xs: T[], chave: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of xs) { const k = chave(x); const l = m.get(k); if (l) l.push(x); else m.set(k, [x]); }
  return m;
}

/** Postgres aceita até 65535 parâmetros por comando: insere em lotes de 500 linhas. */
async function emLotes<T>(linhas: T[], inserir: (v: T[]) => Promise<unknown>) {
  for (let i = 0; i < linhas.length; i += 500) await inserir(linhas.slice(i, i + 500));
}
