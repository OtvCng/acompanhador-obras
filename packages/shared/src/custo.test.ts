import { describe, expect, it } from 'vitest';
import {
  custoMensal, faixaPorSaldo, gastoGeralEtapa, gastoPorCategoria, indicadoresCustoAtividade, indicadoresCustoEtapa,
  indicadoresCustoObra, lerCsv, lerDataBR, lerValorBR, validarLinhasGasto, COLUNAS_PLANILHA_GASTO,
} from './custo';
import type { Gasto, Obra } from './types';

/** Obra mínima: etapa 1 (A 6.000 + B 4.000) e etapa 2 (C 10.000). Orçado 20.000. */
function obraBase(gastos: Partial<Gasto>[] = [], extra: Partial<Obra> = {}): Obra {
  const item = (id: string, v: number, p: number, ini: string, fim: string) =>
    ({ id, localId: 'l1', inicioPlanejado: ini, fimPlanejado: fim, percentual: p, valorOrcado: v });
  const o: Obra = {
    id: 'o1', nome: 'Teste', tipo: 'casa_terrea', endereco: '', cidade: '', areaM2: 100, status: 'em_andamento',
    dataInicio: '2026-01-05', orcamentoTotal: 20_000, engenheiroId: 'e', encarregadoId: 'c',
    locais: [{ id: 'l1', nome: 'Casa', tipo: 'obra', ordem: 0 }],
    etapas: [
      { codigo: 1, nome: 'Serviços preliminares e gerais', valorOrcado: 10_000, valorEstimado: false, atividades: [
        { id: 'a', codigo: '1.01', nome: 'Projetos', etapaCodigo: 1, duracaoConfirmada: true, itens: [item('ia', 6_000, 100, '2026-01-05', '2026-01-30')] },
        { id: 'b', codigo: '1.02', nome: 'Locação da obra', etapaCodigo: 1, duracaoConfirmada: true, itens: [item('ib', 4_000, 50, '2026-02-02', '2026-02-27')] },
      ] },
      { codigo: 2, nome: 'Infraestrutura', valorOrcado: 10_000, valorEstimado: false, atividades: [
        { id: 'c', codigo: '2.01', nome: 'Fundações', etapaCodigo: 2, duracaoConfirmada: true, itens: [item('ic', 10_000, 0, '2026-03-02', '2026-03-31')] },
      ] },
    ],
    baselines: [{ versao: 1, congeladaEm: '2026-01-02', autorId: 'e', itens: {
      ia: { inicio: '2026-01-05', fim: '2026-01-30', valor: 6_000 },
      ib: { inicio: '2026-02-02', fim: '2026-02-27', valor: 4_000 },
      ic: { inicio: '2026-03-02', fim: '2026-03-31', valor: 10_000 },
    } }],
    apontamentos: [
      { id: 'p1', itemId: 'ia', data: '2026-01-30', percentualAnterior: 0, percentualNovo: 100, fotos: [], autorId: 'c' },
      { id: 'p2', itemId: 'ib', data: '2026-02-13', percentualAnterior: 0, percentualNovo: 50, fotos: [], autorId: 'c' },
    ],
    gastos: gastos.map((g, i) => ({
      id: `g${i}`, obraId: 'o1', data: '2026-01-20', etapaCodigo: 1, categoria: 'material', valor: 100, descricao: 'x',
      autorId: 'c', criadoEm: '2026-01-20T10:00:00Z', ...g,
    })),
    ...extra,
  };
  return o;
}
const HOJE = '2026-02-13';

describe('indicadoresCusto', () => {
  it('sem gastos: faixa sem_gastos, saldo = orçado', () => {
    const r = indicadoresCustoObra(obraBase(), HOJE);
    expect(r.orcado).toBe(20_000);
    expect(r.agregado).toBe(8_000); // 6.000×100% + 4.000×50% (só informativo)
    expect(r.gasto).toBe(0);
    expect(r.saldo).toBe(20_000);
    expect(r.consumido).toBe(0);
    expect(r.estouro).toBe(0);
    expect(r.faixa).toBe('sem_gastos');
    expect(r.custoFinalProjetado).toBe(20_000);
    expect(r.sobraProjetada).toBe(0);
  });

  it('regra de saldo: gasto desconta do orçado e NÃO estoura enquanto não passar dele', () => {
    // Gastou mais que o "valor feito" (8.000), mas bem menos que o orçado: está dentro.
    const r = indicadoresCustoObra(obraBase([{ valor: 8_960 }]), HOJE);
    expect(r.gasto).toBe(8_960);
    expect(r.saldo).toBe(11_040);
    expect(r.consumido!).toBeCloseTo(0.448, 6);
    expect(r.estouro).toBe(0);
    expect(r.desvio).toBe(-11_040);
    expect(r.custoFinalProjetado).toBe(20_000);
    expect(r.faixa).toBe('dentro');
  });

  it('caso do Otavio: R$ 300 numa atividade de R$ 4.738,50 sem nada feito = desconta, não estoura', () => {
    const o = obraBase([{ valor: 300, etapaCodigo: 2, atividadeId: 'c' }]);
    const r = indicadoresCustoAtividade(o, 'c', HOJE);
    expect(r.agregado).toBe(0);
    expect(r.saldo).toBe(9_700);
    expect(r.estouro).toBe(0);
    expect(r.faixa).toBe('dentro');
  });

  it('faixas pela regra de saldo', () => {
    expect(faixaPorSaldo(1_000, 0)).toBe('sem_gastos');
    expect(faixaPorSaldo(1_000, 100)).toBe('dentro');
    expect(faixaPorSaldo(1_000, 899.99)).toBe('dentro');
    expect(faixaPorSaldo(1_000, 900)).toBe('atencao'); // 90% usado: perto do limite
    expect(faixaPorSaldo(1_000, 1_000)).toBe('atencao');
    expect(faixaPorSaldo(1_000, 1_000, true)).toBe('dentro'); // concluída no orçado
    expect(faixaPorSaldo(1_000, 1_000.01)).toBe('acima');
    expect(faixaPorSaldo(0, 10)).toBe('acima'); // gasto em algo sem orçado
  });

  it('gasto futuro (data > hoje) não conta', () => {
    const r = indicadoresCustoObra(obraBase([{ valor: 1_000 }, { valor: 5_000, data: '2026-03-10' }]), HOJE);
    expect(r.gasto).toBe(1_000);
  });

  it('etapa que passou do orçado: estouro e custo previsto = gasto', () => {
    const o = obraBase([{ valor: 10_500, etapaCodigo: 2 }]);
    const r = indicadoresCustoEtapa(o, 2, HOJE);
    expect(r.agregado).toBe(0);
    expect(r.saldo).toBe(-500);
    expect(r.estouro).toBe(500);
    expect(r.desvioPct!).toBeCloseTo(0.05, 6);
    expect(r.custoFinalProjetado).toBe(10_500);
    expect(r.sobraProjetada).toBe(-500);
    expect(r.faixa).toBe('acima');
  });

  it('etapa conta gastos com e sem atividade; atividade só os dela', () => {
    const o = obraBase([{ valor: 1_000, atividadeId: 'a' }, { valor: 300 }, { valor: 200, atividadeId: 'b' }, { valor: 50, etapaCodigo: 2 }]);
    expect(indicadoresCustoEtapa(o, 1, HOJE).gasto).toBe(1_500);
    expect(indicadoresCustoAtividade(o, 'a', HOJE).gasto).toBe(1_000);
    expect(gastoGeralEtapa(o, 1, HOJE)).toBe(300);
    expect(gastoGeralEtapa(o, 2, HOJE)).toBe(50);
  });

  it('gasto com atividade que sumiu da etapa cai em "Geral da etapa"', () => {
    const o = obraBase([{ valor: 70, atividadeId: 'removida' }]);
    expect(gastoGeralEtapa(o, 1, HOJE)).toBe(70);
  });

  it('atividade a 100% que gastou 4% a mais: estourou (fechamento)', () => {
    const o = obraBase([{ valor: 6_240, atividadeId: 'a' }]);
    const r = indicadoresCustoAtividade(o, 'a', HOJE);
    expect(r.agregado).toBe(6_000);
    expect(r.custoFinalProjetado).toBe(6_240);
    expect(r.estouro).toBe(240);
    expect(r.desvioPct!).toBeCloseTo(0.04, 6);
    expect(r.faixa).toBe('acima');
  });

  it('obra concluída: EV = BAC mesmo com item abaixo de 100%', () => {
    const o = obraBase([{ valor: 20_800 }], { status: 'concluida' });
    const r = indicadoresCustoObra(o, '2026-04-30');
    expect(r.agregado).toBe(20_000);
    expect(r.custoFinalProjetado).toBe(20_800);
    expect(r.sobraProjetada).toBe(-800);
  });

  it('obra sem campo gastos (dado antigo) não quebra', () => {
    const o = obraBase();
    delete (o as Partial<Obra>).gastos;
    expect(indicadoresCustoObra(o, HOJE).gasto).toBe(0);
    expect(custoMensal(o, HOJE).length).toBe(2);
  });
});

describe('gastoPorCategoria', () => {
  it('soma por categoria, ordena e calcula fração', () => {
    const o = obraBase([
      { valor: 300, categoria: 'material' }, { valor: 100, categoria: 'material' },
      { valor: 600, categoria: 'mao_de_obra' }, { valor: 1_000, categoria: 'terceiros', etapaCodigo: 2 },
    ]);
    const r = gastoPorCategoria(o, HOJE);
    expect(r.map((c) => c.categoria)).toEqual(['terceiros', 'mao_de_obra', 'material']);
    expect(r[0].pct).toBeCloseTo(0.5, 6);
    const e1 = gastoPorCategoria(o, HOJE, 1);
    expect(e1).toEqual([{ categoria: 'mao_de_obra', valor: 600, pct: 0.6 }, { categoria: 'material', valor: 400, pct: 0.4 }]);
    expect(gastoPorCategoria(obraBase(), HOJE)).toEqual([]);
  });
});

describe('custoMensal', () => {
  it('fatias de jan e fev, acumulados batendo com os indicadores', () => {
    const o = obraBase([{ valor: 5_000, data: '2026-01-20' }, { valor: 2_000, data: '2026-02-10' }]);
    const m = custoMensal(o, HOJE);
    expect(m.map((x) => x.mes)).toEqual(['2026-01', '2026-02']);
    expect(m[0]).toMatchObject({ gasto: 5_000, agregado: 6_000, previsto: 6_000, gastoAcum: 5_000, agregadoAcum: 6_000 });
    expect(m[1]).toMatchObject({ gasto: 2_000, agregado: 2_000, gastoAcum: 7_000, agregadoAcum: 8_000 });
    const ind = indicadoresCustoObra(o, HOJE);
    expect(m[1].gastoAcum).toBe(ind.gasto);
    expect(m[1].agregadoAcum).toBe(ind.agregado);
    expect(m[1].previstoAcum).toBe(ind.previsto);
  });

  it('gasto antes do início abre o mês anterior; hoje antes de tudo = vazio', () => {
    const o = obraBase([{ valor: 100, data: '2025-12-15' }]);
    expect(custoMensal(o, HOJE)[0]).toMatchObject({ mes: '2025-12', gasto: 100 });
    expect(custoMensal(obraBase(), '2025-12-01')).toEqual([]);
  });

  it('vira o ano', () => {
    const o = obraBase([], { dataInicio: '2025-11-03' });
    expect(custoMensal(o, '2026-01-15').map((x) => x.mes)).toEqual(['2025-11', '2025-12', '2026-01']);
  });
});

describe('formatos BR', () => {
  it('lerValorBR', () => {
    expect(lerValorBR('1.234,56')).toBe(1234.56);
    expect(lerValorBR('R$ 1.234,56')).toBe(1234.56);
    expect(lerValorBR('1234,5')).toBe(1234.5);
    expect(lerValorBR('1234.56')).toBe(1234.56);
    expect(lerValorBR('12.500')).toBe(12500);
    expect(lerValorBR('1.234.567,89')).toBe(1234567.89);
    expect(lerValorBR('1,234.56')).toBe(1234.56);
    expect(lerValorBR('0.500')).toBe(0.5);
    expect(lerValorBR('1234.567')).toBe(1234.567);
    expect(lerValorBR('350')).toBe(350);
    expect(lerValorBR('-10,00')).toBe(-10);
    expect(lerValorBR('abc')).toBeNull();
    expect(lerValorBR('')).toBeNull();
    expect(lerValorBR('1,2,3')).toBeNull();
  });

  it('lerDataBR', () => {
    expect(lerDataBR('05/01/2026')).toBe('2026-01-05');
    expect(lerDataBR('5/1/26')).toBe('2026-01-05');
    expect(lerDataBR('05-01-2026')).toBe('2026-01-05');
    expect(lerDataBR('2026-01-05')).toBe('2026-01-05');
    expect(lerDataBR('2026-01-05T00:00:00.000Z')).toBe('2026-01-05');
    expect(lerDataBR('46027')).toBe('2026-01-05'); // série do Excel
    expect(lerDataBR('31/02/2026')).toBeNull();
    expect(lerDataBR('2026/13/01')).toBeNull();
    expect(lerDataBR('ontem')).toBeNull();
  });

  it('lerCsv detecta ; e , e respeita aspas', () => {
    const a = lerCsv('﻿data;valor;descricao\r\n05/01/2026;1.234,56;"Cimento; 50 sacos"\r\n');
    expect(a).toEqual([{ data: '05/01/2026', valor: '1.234,56', descricao: 'Cimento; 50 sacos' }]);
    const b = lerCsv('data,valor,descricao\n2026-01-05,"1,234.56","Areia ""fina"""\n\n');
    expect(b[0]).toEqual({ data: '2026-01-05', valor: '1,234.56', descricao: 'Areia "fina"' });
    expect(b).toHaveLength(2); // a linha vazia vem (validarLinhasGasto ignora) e preserva a numeração
  });
});

describe('validarLinhasGasto', () => {
  const o = obraBase();
  it('linha válida com etapa por código, atividade por código e categoria com acento', () => {
    const [r] = validarLinhasGasto(o, [{ Data: '20/01/2026', Etapa: '1', Atividade: '1.02', Categoria: 'MÃO DE OBRA', 'Valor (R$)': '1.500,00', 'Descrição': 'Diária', Fornecedor: 'Zé', 'Nº da nota': '123' }]);
    expect(r.erros).toEqual([]);
    expect(r.linha).toBe(2);
    expect(r.dados).toEqual({ data: '2026-01-20', etapaCodigo: 1, atividadeId: 'b', categoria: 'mao_de_obra', valor: 1500, descricao: 'Diária', fornecedor: 'Zé', documento: '123' });
  });

  it('etapa e atividade por nome; sem atividade = geral da etapa', () => {
    const r = validarLinhasGasto(o, [
      { data: '2026-01-20', etapa: 'infraestrutura', atividade: 'fundações', categoria: 'terceiros', valor: '10', descricao: 'x' },
      { data: '2026-01-20', etapa: '2 - Infraestrutura', atividade: '', categoria: 'Material', valor: '10', descricao: 'x' },
      { data: '2026-01-20', etapa: '1', atividade: '1.02 - Locação da obra', categoria: 'Material', valor: '10', descricao: 'x' },
    ]);
    expect(r[0].dados).toMatchObject({ etapaCodigo: 2, atividadeId: 'c' });
    expect(r[1].dados).toMatchObject({ etapaCodigo: 2 });
    expect(r[1].dados!.atividadeId).toBeUndefined();
    expect(r[2].dados).toMatchObject({ atividadeId: 'b' });
  });

  it('erros por linha com motivo, linha vazia ignorada, numeração da planilha preservada', () => {
    const r = validarLinhasGasto(o, [
      { data: '31/02/2026', etapa: '9', categoria: 'comida', valor: '0', descricao: '' },
      { data: '', etapa: '', categoria: '', valor: '', descricao: '' },
      { data: '01/02/2026', etapa: '1', atividade: '2.01', categoria: 'outros', valor: 'abc', descricao: 'x'.repeat(201) },
    ]);
    expect(r).toHaveLength(2);
    expect(r[0].linha).toBe(2);
    expect(r[0].dados).toBeUndefined();
    expect(r[0].erros.join(' | ')).toMatch(/Data "31\/02\/2026" inválida.*Etapa "9" não existe.*Categoria "comida".*maior que zero.*Descrição em branco/);
    expect(r[1].linha).toBe(4);
    expect(r[1].erros.join(' | ')).toMatch(/Atividade "2.01" não existe na etapa 1.*Valor "abc" inválido.*mais de 200/);
  });

  it('o cabeçalho do modelo é reconhecido', () => {
    const linha = Object.fromEntries(COLUNAS_PLANILHA_GASTO.map((c) => [c, '']));
    Object.assign(linha, { data: '05/01/2026', etapa: '1', categoria: 'material', valor: '1,00', descricao: 'teste' });
    expect(validarLinhasGasto(o, [linha])[0].erros).toEqual([]);
  });
});
