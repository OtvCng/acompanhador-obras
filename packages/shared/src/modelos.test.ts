import { describe, expect, it } from 'vitest';
import { ETAPAS_CAIXA, MODELOS, gerarObra, congelarBaseline, ajustarValorEtapa, pavimentosPadrao } from './modelos';
import { ehDiaUtil, etapasForaDaFaixa } from './calculo';
import type { ParametrosNovaObra, TipoObra, Obra } from './types';

const TIPOS = Object.keys(MODELOS) as TipoObra[];

function params(tipo: TipoObra, extra: Partial<ParametrosNovaObra> = {}): ParametrosNovaObra {
  return {
    nome: 'Obra teste', tipo, endereco: 'Rua Teste, 1', cidade: 'Brusque', areaM2: 200,
    dataInicio: '2026-01-05', orcamentoTotal: 1_234_567.89, engenheiroId: 'e', encarregadoId: 'c', ...extra,
  };
}

const itens = (o: Obra) => o.etapas.flatMap((e) => e.atividades.flatMap((a) => a.itens));
const cents = (n: number) => Math.round(n * 100);

describe('ETAPAS_CAIXA', () => {
  it('tem os 20 itens com faixa e fonte', () => {
    expect(ETAPAS_CAIXA).toHaveLength(20);
    ETAPAS_CAIXA.forEach((e, i) => {
      expect(e.codigo).toBe(i + 1);
      expect(e.fonte).toMatch(/Anexo III/);
      expect(e.faixaMin!).toBeLessThanOrEqual(e.faixaMax!);
    });
  });
});

describe.each(TIPOS)('modelo %s', (tipo) => {
  const m = MODELOS[tipo];

  it('pesos de cada etapa somam 1 e toda etapa ativa tem atividade', () => {
    for (const c of m.etapasAtivas) {
      const soma = m.atividades.filter((a) => a.etapaCodigo === c).reduce((s, a) => s + a.pesoNaEtapa, 0);
      expect(soma, `etapa ${c}`).toBeCloseTo(1, 6);
    }
  });

  it('distribuição padrão soma 100 e fica dentro das faixas Caixa', () => {
    const soma = Object.values(m.distribuicaoPadrao).reduce((s, v) => s + v, 0);
    expect(soma).toBeCloseTo(100, 6);
    for (const c of m.etapasAtivas) {
      const r = ETAPAS_CAIXA[c - 1];
      expect(m.distribuicaoPadrao[c]).toBeGreaterThanOrEqual(r.faixaMin!);
      expect(m.distribuicaoPadrao[c]).toBeLessThanOrEqual(r.faixaMax!);
    }
  });

  it('predecessoras existem e durações sem fonte estão NÃO CONFIRMADAS', () => {
    const cods = new Set(m.atividades.map((a) => a.codigo));
    expect(cods.size).toBe(m.atividades.length);
    for (const a of m.atividades) {
      for (const p of a.predecessoras) expect(cods.has(p), `${a.codigo} -> ${p}`).toBe(true);
      if (a.duracaoConfirmada) expect(a.fonte).toMatch(/CONIMAS/);
    }
  });

  it('gerarObra: soma dos valores = orçamento, datas em dias úteis, precedência respeitada', () => {
    const o = gerarObra(params(tipo), 'x');
    expect(o.status).toBe('planejamento');
    expect(o.baselines).toEqual([]);
    expect(o.locais[0].tipo).toBe('obra');
    const its = itens(o);
    expect(its.reduce((s, i) => s + cents(i.valorOrcado), 0)).toBe(cents(o.orcamentoTotal));
    expect(o.etapas.reduce((s, e) => s + cents(e.valorOrcado), 0)).toBe(cents(o.orcamentoTotal));
    for (const e of o.etapas) {
      expect(e.valorEstimado).toBe(true);
      expect(e.atividades.reduce((s, a) => s + a.itens.reduce((t, i) => t + cents(i.valorOrcado), 0), 0)).toBe(cents(e.valorOrcado));
    }
    for (const i of its) {
      expect(ehDiaUtil(i.inicioPlanejado), i.id).toBe(true);
      expect(ehDiaUtil(i.fimPlanejado), i.id).toBe(true);
      expect(i.fimPlanejado >= i.inicioPlanejado).toBe(true);
      expect(i.inicioPlanejado >= '2026-01-05').toBe(true);
    }
    // predecessora no mesmo local termina antes
    const porCod = new Map(o.etapas.flatMap((e) => e.atividades).map((a) => [a.codigo, a]));
    for (const ma of m.atividades) {
      const a = porCod.get(ma.codigo);
      if (!a) continue;
      for (const p of ma.predecessoras) {
        const pa = porCod.get(p);
        if (!pa) continue;
        for (const it of a.itens) {
          const mesmo = pa.itens.find((x) => x.localId === it.localId);
          if (mesmo) expect(mesmo.fimPlanejado < it.inicioPlanejado, `${p} antes de ${ma.codigo}`).toBe(true);
        }
      }
    }
    expect(etapasForaDaFaixa(o)).toEqual([]);
  });
});

describe('desdobramento por local', () => {
  it('geminadas: um item por unidade e linha de balanço em série', () => {
    const o = gerarObra(params('geminadas', { unidades: 3 }), 'g');
    expect(o.locais.map((l) => l.nome)).toEqual(['Obra toda', 'Casa 1', 'Casa 2', 'Casa 3']);
    const alv = o.etapas.flatMap((e) => e.atividades).find((a) => a.codigo === '4.01')!;
    expect(alv.itens).toHaveLength(3);
    expect(alv.itens[1].inicioPlanejado > alv.itens[0].fimPlanejado).toBe(true);
    expect(alv.itens[2].inicioPlanejado > alv.itens[1].fimPlanejado).toBe(true);
  });

  it('prédio 7+: estrutura em todos os pavimentos, garagem só no subsolo, lojas só no térreo comercial', () => {
    const o = gerarObra(params('predio_7_mais'), 'p');
    const ativ = (c: string) => o.etapas.flatMap((e) => e.atividades).find((a) => a.codigo === c);
    const nomeLocal = (id: string) => o.locais.find((l) => l.id === id)!.nome;
    expect(ativ('3.01')!.itens).toHaveLength(pavimentosPadrao('predio_7_mais').length);
    expect(ativ('12.03')!.itens.map((i) => nomeLocal(i.localId))).toEqual(['Subsolo (garagem)']);
    expect(ativ('5.03')!.itens.map((i) => nomeLocal(i.localId))).toEqual(['Térreo comercial']);
    expect(ativ('20.01')).toBeDefined();
    // ciclo de 9 dias úteis por pavimento, em série
    const est = ativ('3.01')!.itens;
    expect(est[1].inicioPlanejado > est[0].fimPlanejado).toBe(true);
  });

  it('prédio 3-6: elevador só com 5 pavimentos ou mais (Brusque)', () => {
    const com5 = gerarObra(params('predio_3_6'), 'a');
    expect(com5.etapas.flatMap((e) => e.atividades).some((a) => a.codigo === '20.01')).toBe(true);
    const com4 = gerarObra(params('predio_3_6', {
      pavimentos: [
        { nome: 'Térreo', tipoPavimento: 'terreo' },
        { nome: '1º pavimento', tipoPavimento: 'tipo' },
        { nome: '2º pavimento', tipoPavimento: 'tipo' },
        { nome: 'Cobertura', tipoPavimento: 'cobertura' },
      ],
    }), 'b');
    expect(com4.etapas.flatMap((e) => e.atividades).some((a) => a.codigo === '20.01')).toBe(false);
    expect(itens(com4).reduce((s, i) => s + cents(i.valorOrcado), 0)).toBe(cents(com4.orcamentoTotal));
  });
});

describe('congelarBaseline', () => {
  it('v1 sem justificativa, v2 exige justificativa', () => {
    const o = gerarObra(params('casa_terrea'), 'c');
    const v1 = congelarBaseline(o, 'd', '2026-01-02');
    expect(v1.status).toBe('em_andamento');
    expect(v1.baselines).toHaveLength(1);
    expect(Object.keys(v1.baselines[0].itens)).toHaveLength(itens(o).length);
    expect(() => congelarBaseline(v1, 'd', '2026-03-02')).toThrow(/Justificativa/);
    expect(() => congelarBaseline(v1, 'd', '2026-03-02', '   ')).toThrow(/Justificativa/);
    const v2 = congelarBaseline(v1, 'd', '2026-03-02', 'Chuvas');
    expect(v2.baselines[1]).toMatchObject({ versao: 2, justificativa: 'Chuvas', congeladaEm: '2026-03-02' });
    expect(o.baselines).toEqual([]); // imutável
  });
});

describe('ajustarValorEtapa', () => {
  it('mantém o total e marca a etapa como não estimada', () => {
    const o = gerarObra(params('comercial'), 'k');
    const novo = ajustarValorEtapa(o, 3, o.orcamentoTotal * 0.3);
    expect(novo.etapas.find((e) => e.codigo === 3)!.valorEstimado).toBe(false);
    expect(itens(novo).reduce((s, i) => s + cents(i.valorOrcado), 0)).toBe(cents(o.orcamentoTotal));
    expect(etapasForaDaFaixa(novo).map((f) => f.codigo)).toContain(3);
  });
});
