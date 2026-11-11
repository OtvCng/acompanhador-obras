/**
 * Financeiro orçado x realizado (plano docs/planejamento/2026-11-10-15-37-financeiro-orcado-x-realizado.md).
 * Funções puras (rodam no navegador e na API). Convenções:
 * - Frações, não percentuais: desvioPct 0,12 = "12% a mais"; pct de categoria 0..1.
 * - "Gasto real" (AC) conta só gastos com data <= hoje.
 * - Obra concluída (ou etapa/atividade com todos os itens a 100%): EV = BAC (fechamento direto).
 */
import type {
  CategoriaGasto, CustoMes, FaixaCusto, Gasto, IndicadoresCusto, ItemAtividade, LinhaImportacao, Obra, ISODate,
} from './types';
import { planejadoItem } from './calculo';

/** Regra "encarregado nunca recebe R$" DESLIGADA por decisão do Otavio (10/11). true religa (API e web). */
export const OCULTAR_VALORES_ENCARREGADO = false;

export const CATEGORIAS_GASTO: Record<CategoriaGasto, string> = {
  material: 'Material',
  mao_de_obra: 'Mão de obra',
  equipamento: 'Equipamento',
  terceiros: 'Terceiros',
  outros: 'Outros',
};

/**
 * Faixa de custo pela REGRA DE SALDO (decisão do Otavio, 10/11): gasto desconta do orçado; estoura só se passar.
 * `atencao` = fração do orçado já usada a partir da qual avisa "perto do limite" (PROPOSTA, NÃO CONFIRMADA: 90%).
 * Obra/etapa/atividade concluída dentro do orçado fica "dentro" mesmo acima de 90%.
 */
export const FAIXAS_CUSTO = { atencao: 0.9 } as const;

/** Cabeçalho da planilha de importação, na ordem do modelo para baixar. */
export const COLUNAS_PLANILHA_GASTO: string[] = ['data', 'etapa', 'atividade', 'categoria', 'valor', 'descricao', 'fornecedor', 'documento'];

const arred2 = (n: number) => Math.round(n * 100) / 100;
const soma = (gs: Gasto[]) => arred2(gs.reduce((s, g) => s + g.valor, 0));
const gastosAte = (obra: Obra, hoje: ISODate) => (obra.gastos ?? []).filter((g) => g.data <= hoje);

// ---------------------------------------------------------------------------
// Indicadores
// ---------------------------------------------------------------------------
/** Faixa pela regra de saldo: sem gasto · passou do orçado = acima · >= 90% usado (e não concluído) = atenção · senão dentro. */
export function faixaPorSaldo(orcado: number, gasto: number, concluida = false): FaixaCusto {
  if (gasto <= 0) return 'sem_gastos';
  if (gasto > orcado + 0.005) return 'acima'; // inclui gasto em algo sem orçado
  if (!concluida && orcado > 0 && gasto / orcado >= FAIXAS_CUSTO.atencao - 1e-9) return 'atencao';
  return 'dentro';
}

function calcularCusto(obra: Obra, itens: ItemAtividade[], gastos: Gasto[], hoje: ISODate, concluida: boolean): IndicadoresCusto {
  const orcado = arred2(itens.reduce((s, i) => s + i.valorOrcado, 0));
  const agregado = concluida ? orcado : arred2(itens.reduce((s, i) => s + i.valorOrcado * (i.percentual / 100), 0));
  const previsto = arred2(itens.reduce((s, i) => s + i.valorOrcado * planejadoItem(obra, i.id, hoje), 0));
  const gasto = soma(gastos);
  const desvio = arred2(gasto - orcado);
  const custoFinalProjetado = arred2(Math.max(orcado, gasto));
  return {
    orcado, agregado, previsto, gasto,
    cpi: gasto > 0 ? agregado / gasto : null,
    saldo: arred2(orcado - gasto),
    consumido: orcado > 0 ? gasto / orcado : null,
    estouro: arred2(Math.max(0, gasto - orcado)),
    desvio,
    desvioPct: orcado > 0 ? desvio / orcado : null,
    custoFinalProjetado,
    sobraProjetada: arred2(orcado - custoFinalProjetado),
    faixa: faixaPorSaldo(orcado, gasto, concluida),
  };
}

const itensDaObra = (obra: Obra) => obra.etapas.flatMap((e) => e.atividades.flatMap((a) => a.itens));

export function indicadoresCustoObra(obra: Obra, hoje: ISODate): IndicadoresCusto {
  return calcularCusto(obra, itensDaObra(obra), gastosAte(obra, hoje), hoje, obra.status === 'concluida');
}

/** Etapa: orçado/feito dos itens da etapa; gasto = todos os gastos da etapa (com e sem atividade). */
export function indicadoresCustoEtapa(obra: Obra, etapaCodigo: number, hoje: ISODate): IndicadoresCusto {
  const etapa = obra.etapas.find((e) => e.codigo === etapaCodigo);
  const itens = etapa ? etapa.atividades.flatMap((a) => a.itens) : [];
  const gastos = gastosAte(obra, hoje).filter((g) => g.etapaCodigo === etapaCodigo);
  return calcularCusto(obra, itens, gastos, hoje, obra.status === 'concluida');
}

export function indicadoresCustoAtividade(obra: Obra, atividadeId: string, hoje: ISODate): IndicadoresCusto {
  const at = obra.etapas.flatMap((e) => e.atividades).find((a) => a.id === atividadeId);
  const itens = at?.itens ?? [];
  const gastos = gastosAte(obra, hoje).filter((g) => g.atividadeId === atividadeId);
  return calcularCusto(obra, itens, gastos, hoje, obra.status === 'concluida');
}

/**
 * Linha "Geral da etapa": gastos da etapa sem atividade (data <= hoje).
 * Gasto cuja atividade não existe mais na etapa (removida no replanejamento) também cai aqui, para a soma
 * das linhas fechar com o total da etapa.
 */
export function gastoGeralEtapa(obra: Obra, etapaCodigo: number, hoje: ISODate): number {
  const ids = new Set(obra.etapas.find((e) => e.codigo === etapaCodigo)?.atividades.map((a) => a.id) ?? []);
  return soma(gastosAte(obra, hoje).filter((g) => g.etapaCodigo === etapaCodigo && (!g.atividadeId || !ids.has(g.atividadeId))));
}

/** Gasto por categoria (obra toda ou só a etapa), só categorias com gasto, do maior para o menor. pct = fração 0..1. */
export function gastoPorCategoria(obra: Obra, hoje: ISODate, etapaCodigo?: number): { categoria: CategoriaGasto; valor: number; pct: number }[] {
  const gs = gastosAte(obra, hoje).filter((g) => etapaCodigo === undefined || g.etapaCodigo === etapaCodigo);
  const total = gs.reduce((s, g) => s + g.valor, 0);
  if (total <= 0) return [];
  return (Object.keys(CATEGORIAS_GASTO) as CategoriaGasto[])
    .map((categoria) => {
      const valor = soma(gs.filter((g) => g.categoria === categoria));
      return { categoria, valor, pct: valor / total };
    })
    .filter((c) => c.valor > 0)
    .sort((a, b) => b.valor - a.valor);
}

// ---------------------------------------------------------------------------
// Fatias por mês
// ---------------------------------------------------------------------------
function fimDoMes(mes: string): ISODate {
  const [a, m] = mes.split('-').map(Number);
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
}
function proximoMes(mes: string): string {
  const [a, m] = mes.split('-').map(Number);
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}`;
}

/**
 * Fatias por mês, do primeiro mês da obra (ou do gasto mais antigo, se veio antes) até o mês de hoje.
 * Acumulados são medidos no fim de cada mês (ou em hoje, no mês corrente). O valor feito nos meses passados
 * é reconstruído pelo histórico de apontamentos; no mês corrente usa o % atual (bate com os cards).
 * Obra concluída: o último mês fecha com valor feito = orçado.
 */
export function custoMensal(obra: Obra, hoje: ISODate): CustoMes[] {
  const gastos = gastosAte(obra, hoje);
  let inicio = obra.dataInicio;
  for (const g of gastos) if (g.data < inicio) inicio = g.data;
  if (hoje < inicio) return [];
  const itens = itensDaObra(obra);
  const ordenados = obra.apontamentos
    .map((a, idx) => ({ a, idx }))
    .sort((x, y) => (x.a.data === y.a.data ? x.idx - y.idx : x.a.data < y.a.data ? -1 : 1))
    .map((x) => x.a);
  const mesHoje = hoje.slice(0, 7);
  const r: CustoMes[] = [];
  let ant = { gasto: 0, agregado: 0, previsto: 0 };
  for (let mes = inicio.slice(0, 7), guarda = 0; mes <= mesHoje && guarda < 600; mes = proximoMes(mes), guarda++) {
    const corte = mes === mesHoje ? hoje : fimDoMes(mes);
    let agregado: number;
    if (mes === mesHoje) {
      agregado = obra.status === 'concluida'
        ? itens.reduce((s, i) => s + i.valorOrcado, 0)
        : itens.reduce((s, i) => s + i.valorOrcado * (i.percentual / 100), 0);
    } else {
      const pct = new Map<string, number>();
      for (const a of ordenados) { if (a.data > corte) break; pct.set(a.itemId, a.percentualNovo); }
      agregado = itens.reduce((s, i) => s + i.valorOrcado * ((pct.get(i.id) ?? 0) / 100), 0);
    }
    const acum = {
      gasto: soma(gastos.filter((g) => g.data <= corte)),
      agregado: arred2(agregado),
      previsto: arred2(itens.reduce((s, i) => s + i.valorOrcado * planejadoItem(obra, i.id, corte), 0)),
    };
    r.push({
      mes,
      gasto: arred2(acum.gasto - ant.gasto),
      agregado: arred2(acum.agregado - ant.agregado),
      previsto: arred2(acum.previsto - ant.previsto),
      gastoAcum: acum.gasto,
      agregadoAcum: acum.agregado,
      previstoAcum: acum.previsto,
    });
    ant = acum;
  }
  return r;
}

// ---------------------------------------------------------------------------
// Importação de planilha
// ---------------------------------------------------------------------------
/** minúsculas, sem acento, só letras e números. */
export function normalizarTexto(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Lê CSV (separador `;` ou `,` detectado pelo cabeçalho; aspas duplas com "" escapado; BOM ignorado).
 * Devolve uma linha por registro, com as chaves do cabeçalho como vieram. Linhas totalmente vazias são puladas
 * mas a contagem de linha da planilha é preservada pela ordem (use validarLinhasGasto com o array inteiro).
 */
export function lerCsv(texto: string): Record<string, string>[] {
  const t = texto.replace(/^﻿/, '');
  const primeira = t.split(/\r?\n/, 1)[0] ?? '';
  const sep = (primeira.match(/;/g)?.length ?? 0) >= (primeira.match(/,/g)?.length ?? 0) ? ';' : ',';
  const registros: string[][] = [];
  let campo = '';
  let linha: string[] = [];
  let aspas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c === '"') { if (t[i + 1] === '"') { campo += '"'; i++; } else aspas = false; }
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) { linha.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      linha.push(campo); registros.push(linha); linha = []; campo = '';
    } else campo += c;
  }
  if (campo !== '' || linha.length) { linha.push(campo); registros.push(linha); }
  const [cab, ...dados] = registros;
  if (!cab) return [];
  return dados.map((r) => Object.fromEntries(cab.map((k, j) => [k.trim(), (r[j] ?? '').trim()])));
}

/** Cabeçalho da planilha -> coluna do modelo (sem diferenciar acento, maiúscula, espaço ou "(R$)"). */
function colunaDe(chave: string): string | undefined {
  const k = normalizarTexto(chave);
  if (!k) return undefined;
  const sinonimos: Record<string, string[]> = {
    data: ['data', 'dia', 'datadogasto', 'competencia'],
    etapa: ['etapa'],
    atividade: ['atividade', 'servico'],
    categoria: ['categoria', 'tipo', 'tipodegasto'],
    valor: ['valor', 'valorr', 'total', 'valortotal'],
    descricao: ['descricao', 'historico', 'item'],
    fornecedor: ['fornecedor', 'favorecido', 'empresa'],
    documento: ['documento', 'doc', 'nota', 'notafiscal', 'nf', 'nfe', 'recibo', 'numerodanota', 'ndanota'],
  };
  for (const [col, ls] of Object.entries(sinonimos)) if (ls.includes(k)) return col;
  for (const col of COLUNAS_PLANILHA_GASTO) if (k.startsWith(col)) return col;
  return undefined;
}

/**
 * Valor em R$: aceita "1.234,56", "1234,56", "1234.56", "R$ 1.234,56", "12.500" (= 12500, ponto de milhar BR).
 * Regra do ponto sozinho: "1.234" / "12.500" (1 a 3 dígitos antes, exatamente 3 depois, várias casas) = milhar;
 * "1234.567" ou "0.5" = decimal (é o que sai de um número do Excel). Devolve null se não der para ler.
 */
export function lerValorBR(s: string): number | null {
  let t = s.replace(/r\$/gi, '').replace(/\s/g, '');
  if (!t) return null;
  let neg = false;
  if (/^\(.*\)$/.test(t)) { neg = true; t = t.slice(1, -1); }
  if (t.startsWith('-')) { neg = true; t = t.slice(1); }
  if (!/^[\d.,]+$/.test(t)) return null;
  const temPonto = t.includes('.');
  const temVirgula = t.includes(',');
  let n: string;
  if (temPonto && temVirgula) {
    const dec = t.lastIndexOf('.') > t.lastIndexOf(',') ? '.' : ',';
    const mil = dec === '.' ? ',' : '.';
    n = t.split(mil).join('').replace(dec, '.');
    if ((n.match(/\./g)?.length ?? 0) > 1) return null;
  } else if (temVirgula) {
    const partes = t.split(',');
    n = partes.length === 2 ? `${partes[0]}.${partes[1]}` : (partes.slice(1).every((p) => p.length === 3) ? partes.join('') : '');
  } else if (temPonto) {
    const partes = t.split('.');
    if (partes.length > 2) n = partes.slice(1).every((p) => p.length === 3) ? partes.join('') : '';
    else n = /^[1-9]\d{0,2}$/.test(partes[0]) && partes[1].length === 3 ? partes.join('') : t;
  } else n = t;
  if (!n || !/^\d*\.?\d*$/.test(n) || n === '.') return null;
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  return neg ? -v : v;
}

function dataValida(a: number, m: number, d: number): ISODate | null {
  if (a < 1900 || a > 2200 || m < 1 || m > 12 || d < 1) return null;
  const dt = new Date(Date.UTC(a, m - 1, d));
  if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

/** Data: "dd/mm/aaaa", "d/m/aa", "dd-mm-aaaa", "dd.mm.aaaa", ISO "aaaa-mm-dd" (com ou sem hora) ou nº de série do Excel. */
export function lerDataBR(s: string): ISODate | null {
  const t = s.trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/);
  if (m) return dataValida(+m[1], +m[2], +m[3]);
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (m) return dataValida(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  // Série do Excel (dias desde 30/12/1899), faixa ~1954..2119.
  if (/^\d{5}(\.\d+)?$/.test(t)) {
    const n = Math.floor(Number(t));
    if (n >= 20000 && n <= 80000) return new Date(Date.UTC(1899, 11, 30) + n * 86_400_000).toISOString().slice(0, 10);
  }
  return null;
}

const ALIAS_CATEGORIA: Record<string, CategoriaGasto> = {
  material: 'material', materiais: 'material', mat: 'material',
  maodeobra: 'mao_de_obra', mo: 'mao_de_obra', mdo: 'mao_de_obra',
  equipamento: 'equipamento', equipamentos: 'equipamento', equip: 'equipamento', locacao: 'equipamento',
  terceiros: 'terceiros', terceiro: 'terceiros', servicosdeterceiros: 'terceiros', terceirizado: 'terceiros', empreitada: 'terceiros',
  outros: 'outros', outro: 'outros', diversos: 'outros',
};

export const LIMITE_DESCRICAO = 200;
export const LIMITE_TEXTO_CURTO = 120;

/**
 * Valida as linhas da planilha contra a obra. `linhas[i]` = linha i+2 da planilha (linha 1 = cabeçalho).
 * Linhas totalmente vazias são ignoradas (não aparecem no resultado). Linha com qualquer erro fica sem `dados`.
 */
export function validarLinhasGasto(obra: Obra, linhas: Record<string, string>[]): LinhaImportacao[] {
  const r: LinhaImportacao[] = [];
  linhas.forEach((bruta, idx) => {
    const l: Record<string, string> = {};
    for (const [k, v] of Object.entries(bruta)) {
      const col = colunaDe(k);
      if (col && l[col] === undefined) l[col] = String(v ?? '').trim();
    }
    if (Object.values(l).every((v) => !v)) return;
    const erros: string[] = [];

    const data = l.data ? lerDataBR(l.data) : null;
    if (!l.data) erros.push('Data em branco.');
    else if (!data) erros.push(`Data "${l.data}" inválida (use dd/mm/aaaa).`);

    let etapa = undefined as Obra['etapas'][number] | undefined;
    if (!l.etapa) erros.push('Etapa em branco.');
    else {
      const cod = l.etapa.match(/^\s*(\d{1,2})(?:\s*[-–.:)]\s*.*|\s*)$/);
      if (cod) etapa = obra.etapas.find((e) => e.codigo === Number(cod[1]));
      if (!etapa) etapa = obra.etapas.find((e) => normalizarTexto(e.nome) === normalizarTexto(l.etapa));
      if (!etapa) erros.push(`Etapa "${l.etapa}" não existe nesta obra.`);
    }

    let atividadeId: string | undefined;
    if (l.atividade && etapa) {
      // Código ("1.02"), nome ("Locação da obra") ou "código - nome" (o código manda).
      const token = l.atividade.trim().split(/[\s–:]+|\s-\s/)[0];
      const n = normalizarTexto(l.atividade);
      const at = etapa.atividades.find((a) => a.codigo === l.atividade.trim())
        ?? etapa.atividades.find((a) => normalizarTexto(a.nome) === n)
        ?? etapa.atividades.find((a) => a.codigo === token);
      if (at) atividadeId = at.id;
      else erros.push(`Atividade "${l.atividade}" não existe na etapa ${etapa.codigo}.`);
    }

    let categoria: CategoriaGasto | undefined;
    if (!l.categoria) erros.push('Categoria em branco.');
    else {
      const n = normalizarTexto(l.categoria);
      categoria = ALIAS_CATEGORIA[n] ?? (Object.keys(CATEGORIAS_GASTO) as CategoriaGasto[]).find((c) => normalizarTexto(c) === n || normalizarTexto(CATEGORIAS_GASTO[c]) === n);
      if (!categoria) erros.push(`Categoria "${l.categoria}" desconhecida (use ${Object.values(CATEGORIAS_GASTO).join(', ')}).`);
    }

    const valor = l.valor ? lerValorBR(l.valor) : null;
    if (!l.valor) erros.push('Valor em branco.');
    else if (valor === null) erros.push(`Valor "${l.valor}" inválido (use 1.234,56).`);
    else if (valor <= 0) erros.push('Valor precisa ser maior que zero.');
    else if (valor >= 1e12) erros.push('Valor grande demais.');

    const descricao = l.descricao ?? '';
    if (!descricao) erros.push('Descrição em branco.');
    else if (descricao.length > LIMITE_DESCRICAO) erros.push(`Descrição com mais de ${LIMITE_DESCRICAO} caracteres.`);
    if ((l.fornecedor ?? '').length > LIMITE_TEXTO_CURTO) erros.push(`Fornecedor com mais de ${LIMITE_TEXTO_CURTO} caracteres.`);
    if ((l.documento ?? '').length > LIMITE_TEXTO_CURTO) erros.push(`Documento com mais de ${LIMITE_TEXTO_CURTO} caracteres.`);

    const item: LinhaImportacao = { linha: idx + 2, erros };
    if (!erros.length) {
      item.dados = {
        data: data!, etapaCodigo: etapa!.codigo, categoria: categoria!, valor: arred2(valor!), descricao,
        ...(atividadeId ? { atividadeId } : {}),
        ...(l.fornecedor ? { fornecedor: l.fornecedor } : {}),
        ...(l.documento ? { documento: l.documento } : {}),
      };
    }
    r.push(item);
  });
  return r;
}
