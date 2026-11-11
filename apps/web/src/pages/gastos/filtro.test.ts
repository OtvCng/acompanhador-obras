import { describe, expect, it } from 'vitest';
import type { Gasto, Obra } from '@obras/shared';
import { ATIVIDADE_GERAL, FILTRO_VAZIO, filtrarGastos, filtroAtivo, lotesImportados, somarGastos } from './filtro';

const obra = {
  id: 'o1',
  etapas: [
    { codigo: 1, nome: 'Serviços preliminares e gerais', atividades: [{ id: 'a1', codigo: '1.01', nome: 'Projetos' }] },
    { codigo: 3, nome: 'Supraestrutura', atividades: [{ id: 'a3', codigo: '3.01', nome: 'Formas e armação' }] },
  ],
} as unknown as Obra;

const g = (p: Partial<Gasto>): Gasto => ({
  id: p.id ?? Math.random().toString(36),
  obraId: 'o1',
  data: '2026-11-05',
  etapaCodigo: 1,
  categoria: 'material',
  valor: 10,
  descricao: 'x',
  autorId: 'u',
  criadoEm: '2026-11-05T10:00:00Z',
  ...p,
});

const gastos = [
  g({ id: '1', data: '2026-10-01', etapaCodigo: 1, atividadeId: 'a1', valor: 0.1, descricao: 'Taxa da prefeitura' }),
  g({ id: '2', data: '2026-11-03', etapaCodigo: 3, categoria: 'mao_de_obra', valor: 0.2, descricao: 'Diária armador', fornecedor: 'João Ferragens', criadoEm: '2026-11-03T09:00:00Z' }),
  g({ id: '3', data: '2026-11-03', etapaCodigo: 3, atividadeId: 'a3', valor: 1500, descricao: 'Aço CA-50', criadoEm: '2026-11-03T12:00:00Z', importacaoId: 'L1' }),
  g({ id: '4', data: '2026-11-04', etapaCodigo: 3, atividadeId: 'a3', valor: 99.99, descricao: 'Arame', criadoEm: '2026-11-04T12:00:00Z', importacaoId: 'L1' }),
];

describe('filtro de gastos', () => {
  it('sem filtro: todos, mais recentes primeiro', () => {
    expect(filtroAtivo(FILTRO_VAZIO)).toBe(false);
    expect(filtrarGastos(obra, gastos, FILTRO_VAZIO).map((x) => x.id)).toEqual(['4', '3', '2', '1']);
  });
  it('período, etapa, geral da etapa e categoria', () => {
    expect(filtrarGastos(obra, gastos, { ...FILTRO_VAZIO, de: '2026-11-01', ate: '2026-11-03' }).map((x) => x.id)).toEqual(['3', '2']);
    expect(filtrarGastos(obra, gastos, { ...FILTRO_VAZIO, etapa: 3, atividade: ATIVIDADE_GERAL }).map((x) => x.id)).toEqual(['2']);
    expect(filtrarGastos(obra, gastos, { ...FILTRO_VAZIO, atividade: 'a3' }).map((x) => x.id)).toEqual(['4', '3']);
    expect(filtrarGastos(obra, gastos, { ...FILTRO_VAZIO, categoria: 'mao_de_obra' }).map((x) => x.id)).toEqual(['2']);
  });
  it('texto sem acento busca descrição, fornecedor, etapa e atividade', () => {
    const q = (texto: string) => filtrarGastos(obra, gastos, { ...FILTRO_VAZIO, texto }).map((x) => x.id);
    expect(q('joao')).toEqual(['2']);
    expect(q('SERVICOS')).toEqual(['1']);
    expect(q('formas')).toEqual(['4', '3']);
  });
  it('soma sem erro de ponto flutuante', () => {
    expect(somarGastos(gastos.slice(0, 2))).toBe(0.3);
  });
  it('agrupa lotes importados', () => {
    expect(lotesImportados(gastos)).toEqual([
      { id: 'L1', quantidade: 2, total: 1599.99, em: '2026-11-03T12:00:00Z', autorId: 'u', de: '2026-11-03', ate: '2026-11-04' },
    ]);
  });
});
