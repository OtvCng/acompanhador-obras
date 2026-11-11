import { describe, expect, it } from 'vitest';
import { desviosParaJustificar, difDiasUteis } from './justificativa';
import type { Obra } from './types';

// Nov/2026: 09 = segunda; 20/11 feriado nacional.
function obra(fimA1: string, comBaseline = true): Obra {
  return {
    id: 'o', nome: 'T', tipo: 'casa_terrea', endereco: '', cidade: '', areaM2: 1, status: 'em_andamento',
    dataInicio: '2026-11-09', orcamentoTotal: 100, engenheiroId: 'e', encarregadoId: 'c',
    locais: [{ id: 'L0', nome: 'Obra toda', tipo: 'obra', ordem: 0 }],
    etapas: [{
      codigo: 1, nome: 'Preliminares', valorOrcado: 100, valorEstimado: false,
      atividades: [{
        id: 'a', codigo: '1.01', nome: 'Projetos', etapaCodigo: 1, duracaoConfirmada: false,
        itens: [
          { id: 'a1', localId: 'L0', inicioPlanejado: '2026-11-09', fimPlanejado: fimA1, percentual: 0, valorOrcado: 50 },
          { id: 'novo', localId: 'L0', inicioPlanejado: '2026-11-09', fimPlanejado: '2026-11-10', percentual: 0, valorOrcado: 50 },
        ],
      }],
    }],
    baselines: comBaseline ? [{ versao: 1, congeladaEm: '2026-11-06', autorId: 'd', itens: { a1: { inicio: '2026-11-09', fim: '2026-11-13', valor: 50 } } }] : [],
    apontamentos: [], gastos: [],
  } as unknown as Obra;
}

describe('justificativa acima de 5 dias úteis', () => {
  it('difDiasUteis é assinado e pula fim de semana e feriado', () => {
    expect(difDiasUteis('2026-11-13', '2026-11-13')).toBe(0);
    expect(difDiasUteis('2026-11-13', '2026-11-23')).toBe(5); // 16,17,18,19,(20 feriado),23
    expect(difDiasUteis('2026-11-13', '2026-11-24')).toBe(6);
    expect(difDiasUteis('2026-11-13', '2026-11-06')).toBe(-5);
  });

  it('até 5 d.u. da baseline inicial não pede; 6 pede, para atividade e etapa', () => {
    expect(desviosParaJustificar(obra('2026-11-13'), obra('2026-11-23'))).toEqual([]);
    const d = desviosParaJustificar(obra('2026-11-13'), obra('2026-11-24'));
    expect(d.map((x) => `${x.tipo}:${x.codigo}`)).toEqual(['etapa:1', 'atividade:1.01']);
    expect(d[1]).toMatchObject({ desvioInicio: 0, desvioFim: 6, base: { fim: '2026-11-13' }, antes: { fim: '2026-11-13' }, depois: { fim: '2026-11-24' } });
  });

  it('adiantar mais de 5 d.u. também pede', () => {
    expect(desviosParaJustificar(obra('2026-11-13'), obra('2026-11-05')).length).toBe(2);
  });

  it('desvio antigo que não mudou neste save não pede de novo', () => {
    expect(desviosParaJustificar(obra('2026-11-24'), obra('2026-11-24'))).toEqual([]);
  });

  it('mudança acumulada: estava em +4, foi para +6 → pede (régua é a baseline, não o último save)', () => {
    expect(desviosParaJustificar(obra('2026-11-19'), obra('2026-11-24')).length).toBe(2);
  });

  it('sem baseline (primeiro save) não pede', () => {
    expect(desviosParaJustificar(obra('2026-11-13', false), obra('2026-12-30', false))).toEqual([]);
  });
});
