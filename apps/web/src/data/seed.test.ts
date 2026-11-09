import { describe, expect, it } from 'vitest';
import { indicadoresObra, etapasForaDaFaixa, fimPrevisto, curvaS } from '@obras/shared';
import { criarSeed, HOJE_SEED, USUARIOS } from './seed';

describe('seed', () => {
  const obras = criarSeed();
  const ind = Object.fromEntries(obras.map((o) => [o.tipo, indicadoresObra(o, HOJE_SEED)]));

  it('mostra o resumo (debug)', () => {
    for (const o of obras) {
      const i = ind[o.tipo];
      console.log(o.tipo.padEnd(14), i.faixa.padEnd(10), 'spi', i.spi?.toFixed(3), 'real', (i.realizado * 100).toFixed(1),
        'plan', (i.planejado * 100).toFixed(1), 'desv', i.desvioPP.toFixed(1), 'fim', fimPrevisto(o), 'aps', o.apontamentos.length,
        'itens', o.etapas.flatMap((e) => e.atividades.flatMap((a) => a.itens)).length);
    }
  });

  it('6 obras, uma por tipo, com baseline', () => {
    expect(new Set(obras.map((o) => o.tipo)).size).toBe(6);
    for (const o of obras) expect(o.baselines.length).toBeGreaterThan(0);
    expect(obras.some((o) => o.baselines.length >= 2 && o.baselines[1].justificativa)).toBe(true);
  });

  it('estados variados em hoje', () => {
    const faixas = obras.map((o) => ind[o.tipo].faixa).sort();
    expect(faixas).toEqual(['adiantada', 'atencao', 'atrasada', 'concluida', 'no_prazo', 'no_prazo']);
    const atrasada = obras.find((o) => ind[o.tipo].faixa === 'atrasada')!;
    expect(ind[atrasada.tipo].desvioPP).toBeLessThan(-10);
    expect(ind[atrasada.tipo].alertaCaixa).toBe(true);
  });

  it('pelo menos uma etapa fora da faixa Caixa', () => {
    expect(obras.some((o) => etapasForaDaFaixa(o).length > 0)).toBe(true);
  });

  it('usuários: 1 diretor, 2 engenheiros, 3 encarregados, e cada obra aponta para eles', () => {
    expect(USUARIOS.filter((u) => u.perfil === 'diretor')).toHaveLength(1);
    expect(USUARIOS.filter((u) => u.perfil === 'engenheiro')).toHaveLength(2);
    expect(USUARIOS.filter((u) => u.perfil === 'encarregado')).toHaveLength(3);
    for (const o of obras) {
      expect(USUARIOS.find((u) => u.id === o.engenheiroId)?.perfil).toBe('engenheiro');
      expect(USUARIOS.find((u) => u.id === o.encarregadoId)?.perfil).toBe('encarregado');
    }
  });

  it('curva S coerente com o apontamento atual', () => {
    for (const o of obras) {
      const c = curvaS(o, HOJE_SEED);
      expect(c.length).toBeGreaterThan(2);
      for (let k = 1; k < c.length; k++) {
        expect(c[k].previsto).toBeGreaterThanOrEqual(c[k - 1].previsto - 1e-9);
        if (c[k].realizado !== null && c[k - 1].realizado !== null) expect(c[k].realizado!).toBeGreaterThanOrEqual(c[k - 1].realizado! - 1e-9);
      }
      // o último realizado (sexta 06/11) bate com o realizado atual
      const ultimo = [...c].reverse().find((p) => p.realizado !== null);
      if (ultimo) expect(ultimo.realizado!).toBeCloseTo(ind[o.tipo].realizado, 6);
    }
  });
});
