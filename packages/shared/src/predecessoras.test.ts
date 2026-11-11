import { describe, expect, it } from 'vitest';
import { ordemTopologica, reprogramarPorPredecessoras, sucessorasTransitivas, validarPredecessoras } from './predecessoras';
import type { Obra } from './types';

type It = { id: string; ini: string; fim: string; pct?: number };
function etapa(codigo: number, predecessoras: number[], itens: It[]) {
  return {
    codigo, nome: `E${codigo}`, valorOrcado: 100, valorEstimado: false, predecessoras,
    atividades: [{
      id: `a${codigo}`, codigo: `${codigo}.01`, nome: 'A', etapaCodigo: codigo, duracaoConfirmada: false,
      itens: itens.map((i) => ({ id: i.id, localId: 'L0', inicioPlanejado: i.ini, fimPlanejado: i.fim, percentual: i.pct ?? 0, valorOrcado: 10 })),
    }],
  };
}
function obra(etapas: ReturnType<typeof etapa>[]): Obra {
  return {
    id: 'o', nome: 'T', tipo: 'casa_terrea', endereco: '', cidade: '', areaM2: 1, status: 'planejamento',
    dataInicio: '2026-11-09', orcamentoTotal: 300, engenheiroId: 'e', encarregadoId: 'c',
    locais: [{ id: 'L0', nome: 'Obra toda', tipo: 'obra', ordem: 0 }],
    etapas, baselines: [], apontamentos: [], gastos: [],
  } as unknown as Obra;
}

// Nov/2026: 09 = segunda; 20/11 (Consciência Negra) é feriado nacional.
const base = (pctB1 = 0) => obra([
  etapa(1, [], [{ id: 'a1', ini: '2026-11-09', fim: '2026-11-13' }]),
  etapa(2, [1], [{ id: 'b1', ini: '2026-11-11', fim: '2026-11-12', pct: pctB1 }, { id: 'b2', ini: '2026-11-16', fim: '2026-11-17' }]),
  etapa(3, [2], [{ id: 'c1', ini: '2026-11-16', fim: '2026-11-16' }]),
]);

describe('predecessoras por etapa', () => {
  it('empurra a sucessora para o dia útil seguinte ao fim da predecessora, mantendo duração e espaçamento, em cascata', () => {
    const r = reprogramarPorPredecessoras(base());
    expect(r.datas.b1).toEqual({ inicio: '2026-11-16', fim: '2026-11-17' });
    // b2 desloca os mesmos 3 dias úteis: 19/11 + 2 d.u. pula o feriado de 20/11 e o fim de semana
    expect(r.datas.b2).toEqual({ inicio: '2026-11-19', fim: '2026-11-23' });
    expect(r.datas.c1).toEqual({ inicio: '2026-11-24', fim: '2026-11-24' });
    expect(r.empurradas).toEqual([{ codigo: 2, dias: 3 }, { codigo: 3, dias: 5 }]);
    expect(r.datas.a1).toBeUndefined();
  });

  it('só empurra para frente: sucessora já depois do fim fica onde está', () => {
    const o = base();
    const r = reprogramarPorPredecessoras(o, { b1: { inicio: '2026-11-30', fim: '2026-11-30' }, b2: { inicio: '2026-12-01', fim: '2026-12-01' } });
    expect(r.datas.b1).toBeUndefined();
    // a etapa 3 depende da 2, que agora termina em 01/12, então ela é empurrada
    expect(r.empurradas.map((e) => e.codigo)).toEqual([3]);
  });

  it('usa as datas do rascunho (base) da predecessora', () => {
    const r = reprogramarPorPredecessoras(base(), { a1: { inicio: '2026-11-09', fim: '2026-11-19' } });
    expect(r.datas.b1?.inicio).toBe('2026-11-23'); // 20/11 feriado + fim de semana
  });

  it('etapa já iniciada não se move e vira violação; as seguintes respeitam as datas dela', () => {
    const r = reprogramarPorPredecessoras(base(10));
    expect(r.datas.b1).toBeUndefined();
    expect(r.violacoes).toEqual([{ codigo: 2, inicioMinimo: '2026-11-16' }]);
    expect(r.datas.c1).toEqual({ inicio: '2026-11-18', fim: '2026-11-18' });
  });

  it('validação: autorreferência, inexistente, repetida e ciclo', () => {
    expect(validarPredecessoras([{ codigo: 1, predecessoras: [1] }])[0]).toMatch(/dela mesma/);
    expect(validarPredecessoras([{ codigo: 1, predecessoras: [9] }])[0]).toMatch(/não existe/);
    expect(validarPredecessoras([{ codigo: 1 }, { codigo: 2, predecessoras: [1, 1] }])[0]).toMatch(/repetida/);
    expect(validarPredecessoras([{ codigo: 1, predecessoras: [2] }, { codigo: 2, predecessoras: [1] }])[0]).toMatch(/ciclo/);
    expect(validarPredecessoras([{ codigo: 1 }, { codigo: 2, predecessoras: [1] }])).toEqual([]);
  });

  it('ordem topológica e sucessoras transitivas (opções que criariam ciclo)', () => {
    const e = [{ codigo: 3, predecessoras: [2] }, { codigo: 2, predecessoras: [1] }, { codigo: 1 }, { codigo: 4 }];
    expect(ordemTopologica(e)).toEqual([1, 4, 2, 3]);
    expect([...sucessorasTransitivas(e, 1)].sort()).toEqual([1, 2, 3]);
  });

  it('sem predecessoras, nada muda', () => {
    const o = obra([etapa(1, [], [{ id: 'x', ini: '2026-11-09', fim: '2026-11-10' }]), etapa(2, [], [{ id: 'y', ini: '2026-11-09', fim: '2026-11-10' }])]);
    expect(reprogramarPorPredecessoras(o)).toEqual({ datas: {}, empurradas: [], violacoes: [] });
  });
});
