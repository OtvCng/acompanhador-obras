import { describe, expect, it } from 'vitest';
import {
  addDiasUteis, contarDiasUteis, curvaS, ehDiaUtil, faixaPorSpi, feriadosNacionais, indicadoresObra, pascoa,
  planejadoItem, etapasForaDaFaixa, fimPrevisto,
} from './calculo';
import type { Obra } from './types';

describe('feriados e dias úteis', () => {
  it('calcula a Páscoa', () => {
    expect(pascoa(2024)).toBe('2024-03-31');
    expect(pascoa(2025)).toBe('2025-04-20');
    expect(pascoa(2026)).toBe('2026-04-05');
  });

  it('inclui feriados fixos e móveis de 2026', () => {
    const f = feriadosNacionais(2026);
    for (const d of ['2026-01-01', '2026-04-21', '2026-05-01', '2026-09-07', '2026-10-12', '2026-11-02', '2026-11-15', '2026-11-20', '2026-12-25'])
      expect(f).toContain(d);
    expect(f).toContain('2026-02-16'); // Carnaval segunda
    expect(f).toContain('2026-02-17'); // Carnaval terça
    expect(f).toContain('2026-04-03'); // Sexta-feira Santa
    expect(f).toContain('2026-06-04'); // Corpus Christi
  });

  it('fim de semana e feriado não são dias úteis', () => {
    expect(ehDiaUtil('2026-11-07')).toBe(false); // sábado
    expect(ehDiaUtil('2026-11-08')).toBe(false); // domingo
    expect(ehDiaUtil('2026-11-02')).toBe(false); // Finados (segunda)
    expect(ehDiaUtil('2026-11-03')).toBe(true);
    expect(ehDiaUtil('2026-04-03')).toBe(false); // Sexta-feira Santa
  });

  it('addDiasUteis pula fins de semana e feriados', () => {
    expect(addDiasUteis('2026-11-06', 0)).toBe('2026-11-06');
    expect(addDiasUteis('2026-11-06', 1)).toBe('2026-11-09');
    expect(addDiasUteis('2026-10-30', 1)).toBe('2026-11-03'); // pula fim de semana e Finados
    expect(addDiasUteis('2026-11-07', 0)).toBe('2026-11-09'); // sábado começa na segunda
    expect(addDiasUteis('2026-11-19', 1)).toBe('2026-11-23'); // pula 20/11 e fim de semana
  });

  it('contarDiasUteis é inclusivo e bate com a contagem dia a dia', () => {
    expect(contarDiasUteis('2026-11-09', '2026-11-13')).toBe(5);
    expect(contarDiasUteis('2026-11-02', '2026-11-06')).toBe(4); // Finados
    expect(contarDiasUteis('2026-11-07', '2026-11-08')).toBe(0);
    expect(contarDiasUteis('2026-11-10', '2026-11-09')).toBe(0);
    // Compara com contagem ingênua num intervalo longo que cruza o ano
    let n = 0;
    for (let d = '2025-12-01'; d <= '2027-02-28'; d = addDias1(d)) if (ehDiaUtil(d)) n++;
    expect(contarDiasUteis('2025-12-01', '2027-02-28')).toBe(n);
  });

  it('addDiasUteis e contarDiasUteis são inversos', () => {
    for (const n of [1, 5, 9, 37, 200]) {
      const fim = addDiasUteis('2026-01-02', n - 1);
      expect(contarDiasUteis('2026-01-02', fim)).toBe(n);
    }
  });
});

function addDias1(d: string): string {
  const t = new Date(d + 'T00:00:00Z');
  t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString().slice(0, 10);
}

/** Obra mínima: dois itens com pesos 75/25. */
function obraTeste(): Obra {
  return {
    id: 'o', nome: 'Teste', tipo: 'casa_terrea', endereco: '', cidade: '', areaM2: 100, status: 'em_andamento',
    dataInicio: '2026-11-09', orcamentoTotal: 1000, engenheiroId: 'e', encarregadoId: 'c',
    locais: [{ id: 'L0', nome: 'Obra toda', tipo: 'obra', ordem: 0 }],
    etapas: [{
      codigo: 1, nome: 'Serviços preliminares e gerais', valorOrcado: 1000, valorEstimado: false,
      atividades: [{
        id: 'a', codigo: '1.01', nome: 'A', etapaCodigo: 1, duracaoConfirmada: false,
        itens: [
          { id: 'i1', localId: 'L0', inicioPlanejado: '2026-11-09', fimPlanejado: '2026-11-13', percentual: 0, valorOrcado: 750 },
          { id: 'i2', localId: 'L0', inicioPlanejado: '2026-11-16', fimPlanejado: '2026-11-27', percentual: 0, valorOrcado: 250 },
        ],
      }],
    }],
    baselines: [{
      versao: 1, congeladaEm: '2026-11-06', autorId: 'd',
      itens: {
        i1: { inicio: '2026-11-09', fim: '2026-11-13', valor: 750 },
        i2: { inicio: '2026-11-16', fim: '2026-11-27', valor: 250 },
      },
    }],
    apontamentos: [],
  };
}

describe('planejado linear em dias úteis', () => {
  it('0 antes, fração no meio, 1 depois', () => {
    const o = obraTeste();
    expect(planejadoItem(o, 'i1', '2026-11-06')).toBe(0);
    expect(planejadoItem(o, 'i1', '2026-11-09')).toBeCloseTo(1 / 5);
    expect(planejadoItem(o, 'i1', '2026-11-11')).toBeCloseTo(3 / 5);
    expect(planejadoItem(o, 'i1', '2026-11-14')).toBe(1); // sábado depois do fim
    expect(planejadoItem(o, 'i1', '2026-11-13')).toBe(1);
  });

  it('sem baseline o planejado é 0 e a faixa é não iniciada', () => {
    const o = { ...obraTeste(), baselines: [] };
    expect(planejadoItem(o, 'i1', '2026-11-20')).toBe(0);
    const ind = indicadoresObra(o, '2026-11-20');
    expect(ind.planejado).toBe(0);
    expect(ind.spi).toBeNull();
    expect(ind.faixa).toBe('nao_iniciada');
  });

  it('indicadores ponderados por valor', () => {
    const o = obraTeste();
    o.etapas[0].atividades[0].itens[0].percentual = 100;
    const ind = indicadoresObra(o, '2026-11-13'); // i1 deveria estar 100%, i2 0%
    expect(ind.realizado).toBeCloseTo(0.75);
    expect(ind.planejado).toBeCloseTo(0.75);
    expect(ind.spi).toBeCloseTo(1);
    expect(ind.faixa).toBe('no_prazo');
    expect(ind.valorAgregado).toBe(750);
    expect(ind.valorPlanejado).toBe(750);
    expect(ind.alertaCaixa).toBe(false);
  });

  it('desvio maior que 10 pp aciona o alerta Caixa', () => {
    const o = obraTeste();
    o.etapas[0].atividades[0].itens[0].percentual = 80; // realizado 0,60 x planejado 0,75
    const ind = indicadoresObra(o, '2026-11-13');
    expect(ind.desvioPP).toBeCloseTo(-15);
    expect(ind.alertaCaixa).toBe(true);
    expect(ind.faixa).toBe('atrasada'); // SPI 0,80
  });
});

describe('faixas do SPI nos limites', () => {
  it('régua Q15', () => {
    expect(faixaPorSpi(1.01, 0.5, false)).toBe('adiantada');
    expect(faixaPorSpi(1.004, 0.5, false)).toBe('no_prazo'); // arredonda para 1,00
    expect(faixaPorSpi(1.0, 0.5, false)).toBe('no_prazo');
    expect(faixaPorSpi(0.95, 0.5, false)).toBe('no_prazo');
    expect(faixaPorSpi(0.946, 0.5, false)).toBe('no_prazo'); // 0,95 arredondado
    expect(faixaPorSpi(0.944, 0.5, false)).toBe('atencao');
    expect(faixaPorSpi(0.85, 0.5, false)).toBe('atencao');
    expect(faixaPorSpi(0.849, 0.5, false)).toBe('atencao'); // 0,85 arredondado
    expect(faixaPorSpi(0.844, 0.5, false)).toBe('atrasada');
    expect(faixaPorSpi(null, 0, false)).toBe('nao_iniciada');
    expect(faixaPorSpi(null, 0.1, false)).toBe('adiantada');
    expect(faixaPorSpi(0.5, 0.5, true)).toBe('concluida');
  });
});

describe('curva S', () => {
  it('pontos às sextas, previsto e realizado monotônicos, null depois de hoje', () => {
    const o = obraTeste();
    o.apontamentos = [
      { id: 'p1', itemId: 'i1', data: '2026-11-10', percentualAnterior: 0, percentualNovo: 30, fotos: [], autorId: 'c' },
      { id: 'p2', itemId: 'i1', data: '2026-11-13', percentualAnterior: 30, percentualNovo: 100, fotos: [], autorId: 'c' },
      { id: 'p3', itemId: 'i2', data: '2026-11-18', percentualAnterior: 0, percentualNovo: 40, fotos: [], autorId: 'c' },
    ];
    o.etapas[0].atividades[0].itens[0].percentual = 100;
    o.etapas[0].atividades[0].itens[1].percentual = 40;
    const pts = curvaS(o, '2026-11-20');
    expect(pts.map((p) => p.data)).toEqual(['2026-11-13', '2026-11-20', '2026-11-27']);
    for (let k = 1; k < pts.length; k++) expect(pts[k].previsto).toBeGreaterThanOrEqual(pts[k - 1].previsto);
    expect(pts.at(-1)!.previsto).toBeCloseTo(1);
    expect(pts[0].realizado).toBeCloseTo(0.75);
    expect(pts[1].realizado).toBeCloseTo(0.85);
    expect(pts[1].realizadoValor).toBe(850);
    expect(pts[2].realizado).toBeNull();
    expect(pts[2].realizadoValor).toBeNull();
    expect(fimPrevisto(o)).toBe('2026-11-27');
  });
});

describe('faixa Caixa', () => {
  it('etapa única com 100% fica fora da faixa', () => {
    const fora = etapasForaDaFaixa(obraTeste());
    expect(fora).toEqual([{ codigo: 1, percentual: 100, faixaMin: 1.13, faixaMax: 3.97 }]);
  });
});
