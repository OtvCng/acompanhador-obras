import { describe, expect, it } from 'vitest';
import {
  adicionarPavimento, atividadePorAndar, dividirPorAndar, juntarEmObraToda, locaisDeAndar,
  motivoBloqueioRemocao, removerPavimento, sincronizarAvancoEstrutura, sincronizarBaselineEstrutura,
} from './estrutura';
import { congelarBaseline, gerarObra } from './modelos';
import type { Atividade, Obra, ParametrosNovaObra, TipoObra } from './types';

function params(tipo: TipoObra, extra: Partial<ParametrosNovaObra> = {}): ParametrosNovaObra {
  return {
    nome: 'Obra teste', tipo, endereco: 'Rua Teste, 1', cidade: 'Brusque', areaM2: 200,
    dataInicio: '2026-01-05', orcamentoTotal: 1_234_567.89, engenheiroId: 'e', encarregadoId: 'c', ...extra,
  };
}
const cents = (n: number) => Math.round(n * 100);
const somaC = (ns: number[]) => ns.reduce((s, n) => s + cents(n), 0);
const ativ = (o: Obra, codigo: string): Atividade => o.etapas.flatMap((e) => e.atividades).find((a) => a.codigo === codigo)!;
const totalObra = (o: Obra) => somaC(o.etapas.flatMap((e) => e.atividades.flatMap((a) => a.itens.map((i) => i.valorOrcado))));
const totalBase = (o: Obra) => somaC(Object.values(o.baselines[0].itens).map((e) => e.valor));
const ids = () => { let n = 0; return (p: string) => `${p}-novo-${++n}`; };

/** Prédio 3-6 (Térreo, 1º, 2º, 3º, Cobertura) com baseline v1 congelada. */
function predio(): Obra {
  return congelarBaseline(gerarObra(params('predio_3_6'), 'p'), 'e', '2026-01-02');
}
/** Primeira atividade "obra toda" do prédio. */
function obraToda(o: Obra): Atividade {
  return o.etapas.flatMap((e) => e.atividades).find((a) => !atividadePorAndar(o, a.id))!;
}

describe('consultas', () => {
  it('locaisDeAndar ignora "Obra toda" e ordena; atividadePorAndar', () => {
    const o = predio();
    expect(locaisDeAndar(o).map((l) => l.nome)).toEqual(['Térreo', '1º pavimento', '2º pavimento', '3º pavimento', 'Cobertura']);
    expect(atividadePorAndar(o, ativ(o, '18.02').id)).toBe(true);
    expect(atividadePorAndar(o, obraToda(o).id)).toBe(false);
  });
});

describe('dividirPorAndar (Leva 2)', () => {
  it('um item por andar; original vira o do 1º andar; valor dividido igual com resto no último; datas e % copiados', () => {
    const o = predio();
    const a0 = obraToda(o);
    a0.itens[0].valorOrcado = 1000.03;
    a0.itens[0].percentual = 40;
    a0.itens[0].inicioReal = '2026-01-06';
    const o2 = { ...o, baselines: [{ ...o.baselines[0], itens: { ...o.baselines[0].itens, [a0.itens[0].id]: { ...o.baselines[0].itens[a0.itens[0].id], valor: 1000.03 } } }] };
    const copia = JSON.stringify(o2);
    const r = dividirPorAndar(o2, a0.id, ids());
    expect(JSON.stringify(o2)).toBe(copia); // pura
    const a = r.etapas.flatMap((e) => e.atividades).find((x) => x.id === a0.id)!;
    const andares = locaisDeAndar(r);
    expect(a.itens.map((i) => i.localId)).toEqual(andares.map((l) => l.id));
    expect(a.itens[0].id).toBe(a0.itens[0].id);
    expect(a.itens[1].id).toBe('item-novo-1');
    expect(a.itens.map((i) => i.valorOrcado)).toEqual([200, 200, 200, 200, 200.03]);
    for (const i of a.itens) {
      expect(i.percentual).toBe(40);
      expect(i.inicioReal).toBe('2026-01-06');
      expect(i.inicioPlanejado).toBe(a0.itens[0].inicioPlanejado);
      expect(i.fimPlanejado).toBe(a0.itens[0].fimPlanejado);
    }
    // baseline: datas da entrada original, valores divididos igual
    const entOrig = o2.baselines[0].itens[a0.itens[0].id];
    const b = r.baselines[0].itens;
    expect(a.itens.map((i) => b[i.id].valor)).toEqual([200, 200, 200, 200, 200.03]);
    for (const i of a.itens) expect([b[i.id].inicio, b[i.id].fim]).toEqual([entOrig.inicio, entOrig.fim]);
    expect(totalObra(r)).toBe(totalObra(o2));
    expect(totalBase(r)).toBe(totalBase(o2));
  });

  it('respeita localIds (subconjunto) e lança erro se a atividade já é por andar', () => {
    const o = predio();
    const a0 = obraToda(o);
    const [, l1, , l3] = locaisDeAndar(o);
    const r = dividirPorAndar(o, a0.id, ids(), [l3.id, l1.id]);
    const a = r.etapas.flatMap((e) => e.atividades).find((x) => x.id === a0.id)!;
    expect(a.itens.map((i) => i.localId)).toEqual([l1.id, l3.id]);
    expect(() => dividirPorAndar(o, ativ(o, '18.02').id, ids())).toThrow();
    expect(() => dividirPorAndar(r, a0.id, ids())).toThrow();
  });
});

describe('juntarEmObraToda (Leva 2)', () => {
  it('mantém o id do 1º andar, span das datas, % ponderado, real e baseline (span + soma)', () => {
    const o = predio();
    const a0 = ativ(o, '18.02');
    expect(a0.itens.length).toBeGreaterThanOrEqual(2);
    a0.itens.forEach((i, k) => { i.valorOrcado = k === 0 ? 300 : 100; i.percentual = k === 0 ? 100 : 0; });
    a0.itens[0].inicioReal = '2026-05-04';
    a0.itens[0].fimReal = '2026-05-08';
    const antesBase = a0.itens.map((i) => o.baselines[0].itens[i.id]);
    const r = juntarEmObraToda(o, a0.id, ids());
    const a = r.etapas.flatMap((e) => e.atividades).find((x) => x.id === a0.id)!;
    expect(a.itens).toHaveLength(1);
    const it0 = a.itens[0];
    expect(it0.id).toBe(a0.itens[0].id);
    expect(r.locais.find((l) => l.id === it0.localId)!.tipo).toBe('obra');
    const totalV = 300 + 100 * (a0.itens.length - 1);
    expect(it0.valorOrcado).toBe(totalV);
    expect(it0.percentual).toBe(Math.round((100 * 300) / totalV));
    expect(it0.inicioPlanejado).toBe(a0.itens.map((i) => i.inicioPlanejado).sort()[0]);
    expect(it0.fimPlanejado).toBe(a0.itens.map((i) => i.fimPlanejado).sort().at(-1));
    expect(it0.inicioReal).toBe('2026-05-04');
    expect(it0.fimReal).toBeUndefined(); // só se todos tiverem fim real
    const b = r.baselines[0].itens;
    expect(b[it0.id]).toEqual({
      inicio: antesBase.map((e) => e.inicio).sort()[0],
      fim: antesBase.map((e) => e.fim).sort().at(-1),
      valor: somaC(antesBase.map((e) => e.valor)) / 100,
    });
    for (const i of a0.itens.slice(1)) expect(b[i.id]).toBeUndefined();
    expect(totalBase(r)).toBe(totalBase(o));
  });

  it('fimReal = o maior quando todos têm; cria "Obra toda" com ordem -1 se faltar; erro com 1 item', () => {
    const o = predio();
    o.locais = o.locais.filter((l) => l.tipo !== 'obra');
    const a0 = ativ(o, '18.02');
    a0.itens.forEach((i, k) => { i.fimReal = `2026-06-1${k}`; });
    const r = juntarEmObraToda(o, a0.id, ids());
    const lo = r.locais.find((l) => l.tipo === 'obra')!;
    expect(lo).toEqual({ id: 'local-novo-1', nome: 'Obra toda', tipo: 'obra', ordem: -1 });
    const it0 = ativ(r, '18.02').itens[0];
    expect(it0.localId).toBe(lo.id);
    expect(it0.fimReal).toBe(`2026-06-1${a0.itens.length - 1}`);
    expect(() => juntarEmObraToda(r, a0.id, ids())).toThrow();
  });

  it('ida e volta (dividir → juntar) preserva valor e baseline', () => {
    const o = predio();
    const a0 = obraToda(o);
    const r = juntarEmObraToda(dividirPorAndar(o, a0.id, ids()), a0.id, ids());
    const a = r.etapas.flatMap((e) => e.atividades).find((x) => x.id === a0.id)!;
    expect(a.itens[0]).toMatchObject({ id: a0.itens[0].id, localId: a0.itens[0].localId, valorOrcado: a0.itens[0].valorOrcado });
    expect(r.baselines[0].itens).toEqual(o.baselines[0].itens);
  });
});

describe('adicionarPavimento (Leva 3)', () => {
  it('insere na posição, renumera ordem 0..n-1, filtra por tiposPavimento e copia datas do vizinho de baixo', () => {
    const o = predio();
    const r = adicionarPavimento(o, { nome: '4º pavimento', tipo: 'pavimento', tipoPavimento: 'tipo', posicao: 4 }, ids());
    const andares = locaisDeAndar(r);
    expect(andares.map((l) => l.nome)).toEqual(['Térreo', '1º pavimento', '2º pavimento', '3º pavimento', '4º pavimento', 'Cobertura']);
    expect(andares.map((l) => l.ordem)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(r.locais.find((l) => l.tipo === 'obra')!.ordem).toBe(0); // fica de fora
    const novo = andares[4];
    expect(novo).toEqual({ id: 'local-novo-1', nome: '4º pavimento', tipo: 'pavimento', tipoPavimento: 'tipo', ordem: 4 });
    // 18.01 existe em 'tipo' → cria; 8.03 só cobertura/casa de máquinas → não cria; obra toda → não cria
    const a1801 = ativ(r, '18.01');
    const n1801 = a1801.itens.find((i) => i.localId === novo.id)!;
    expect(n1801).toBeDefined();
    expect(ativ(r, '8.03').itens.some((i) => i.localId === novo.id)).toBe(false);
    expect(obraToda(r).itens).toHaveLength(1);
    // datas do vizinho de baixo (3º pavimento), % 0, sem real
    const viz = ativ(o, '18.01').itens.find((i) => i.localId === andares[3].id)!;
    expect(n1801).toMatchObject({ inicioPlanejado: viz.inicioPlanejado, fimPlanejado: viz.fimPlanejado, percentual: 0 });
    expect(n1801.inicioReal).toBeUndefined();
    // itens na ordem dos andares, valor redividido igual (total preservado)
    expect(a1801.itens.map((i) => i.localId)).toEqual(andares.filter((l) => ativ(r, '18.01').itens.some((i) => i.localId === l.id)).map((l) => l.id));
    const total1801 = somaC(ativ(o, '18.01').itens.map((i) => i.valorOrcado));
    expect(somaC(a1801.itens.map((i) => i.valorOrcado))).toBe(total1801);
    const vs = a1801.itens.map((i) => cents(i.valorOrcado));
    expect(new Set(vs.slice(0, -1)).size).toBe(1);
    expect(vs.at(-1)! - vs[0]).toBeGreaterThanOrEqual(0);
    expect(vs.at(-1)! - vs[0]).toBeLessThan(vs.length);
    // baseline: datas do vizinho, valores seguem a redivisão
    const b = r.baselines[0].itens;
    const bViz = o.baselines[0].itens[viz.id];
    expect([b[n1801.id].inicio, b[n1801.id].fim]).toEqual([bViz.inicio, bViz.fim]);
    expect(a1801.itens.map((i) => b[i.id].valor)).toEqual(a1801.itens.map((i) => i.valorOrcado));
    expect(totalObra(r)).toBe(totalObra(o));
    expect(totalBase(r)).toBe(totalBase(o));
  });

  it('na posição 0 usa o vizinho de cima', () => {
    const o = predio();
    const r = adicionarPavimento(o, { nome: 'Térreo 2', tipo: 'pavimento', tipoPavimento: 'terreo', posicao: 0 }, ids());
    const novo = locaisDeAndar(r)[0];
    const a = ativ(r, '18.02');
    const n = a.itens.find((i) => i.localId === novo.id)!;
    const viz = ativ(o, '18.02').itens[0];
    expect([n.inicioPlanejado, n.fimPlanejado]).toEqual([viz.inicioPlanejado, viz.fimPlanejado]);
    expect(a.itens[0].id).toBe(n.id);
  });

  it('unidade (geminadas) sempre cria o item', () => {
    const o = congelarBaseline(gerarObra(params('geminadas', { unidades: 2 }), 'g'), 'e', '2026-01-02');
    const porAndar = o.etapas.flatMap((e) => e.atividades).filter((a) => atividadePorAndar(o, a.id));
    const r = adicionarPavimento(o, { nome: 'Casa 3', tipo: 'unidade', posicao: 2 }, ids());
    const novo = locaisDeAndar(r)[2];
    for (const a0 of porAndar) {
      const a = r.etapas.flatMap((e) => e.atividades).find((x) => x.id === a0.id)!;
      expect(a.itens).toHaveLength(a0.itens.length + 1);
      expect(a.itens.at(-1)!.localId).toBe(novo.id);
    }
    expect(totalObra(r)).toBe(totalObra(o));
    expect(totalBase(r)).toBe(totalBase(o));
  });

  it('obra sem andares: primeiro andar não cria itens', () => {
    const o = gerarObra(params('casa_terrea'), 'c');
    const r = adicionarPavimento(o, { nome: 'Superior', tipo: 'pavimento', tipoPavimento: 'tipo', posicao: 0 }, ids());
    expect(locaisDeAndar(r)).toHaveLength(1);
    expect(JSON.stringify(r.etapas)).toBe(JSON.stringify(o.etapas));
    expect(r.baselines).toEqual([]);
  });
});

describe('motivoBloqueioRemocao / removerPavimento (Leva 3)', () => {
  it('bloqueia o último andar', () => {
    const o = gerarObra(params('sobrado'), 's');
    const andares = locaisDeAndar(o);
    let r = o;
    for (const l of andares.slice(1)) r = removerPavimento(r, l.id);
    expect(motivoBloqueioRemocao(r, andares[0].id)).toMatch(/último andar/);
    expect(() => removerPavimento(r, andares[0].id)).toThrow(/último andar/);
  });

  it('bloqueia andar com avanço (% > 0)', () => {
    const o = predio();
    const l = locaisDeAndar(o)[1];
    ativ(o, '18.02').itens.find((i) => i.localId === l.id)!.percentual = 5;
    expect(motivoBloqueioRemocao(o, l.id)).toMatch(/avanço/);
    expect(() => removerPavimento(o, l.id)).toThrow(/avanço/);
  });

  it('bloqueia andar com apontamento no histórico (mesmo com % voltando a 0)', () => {
    const o = predio();
    const l = locaisDeAndar(o)[1];
    const it0 = ativ(o, '18.02').itens.find((i) => i.localId === l.id)!;
    o.apontamentos = [{ id: 'ap1', itemId: it0.id, data: '2026-03-02', percentualAnterior: 10, percentualNovo: 0, fotos: [], autorId: 'c' }];
    expect(motivoBloqueioRemocao(o, l.id)).toMatch(/apontamento/);
  });

  it('bloqueia quando a atividade ficaria sem itens e tem gasto', () => {
    const o = predio();
    const cob = locaisDeAndar(o).at(-1)!;
    const a = ativ(o, '8.03'); // só existe na cobertura
    expect(a.itens.map((i) => i.localId)).toEqual([cob.id]);
    expect(motivoBloqueioRemocao(o, cob.id)).toBeNull();
    o.gastos = [{ id: 'g1', obraId: o.id, data: '2026-02-02', etapaCodigo: 8, atividadeId: a.id, categoria: 'material', valor: 10, descricao: 'x', autorId: 'e', criadoEm: '' }];
    expect(motivoBloqueioRemocao(o, cob.id)).toMatch(/gasto/);
  });

  it('bloqueia quando a etapa ficaria sem atividade', () => {
    const o = predio();
    const cob = locaisDeAndar(o).at(-1)!;
    const e8 = o.etapas.find((e) => e.codigo === 8)!;
    e8.atividades = e8.atividades.filter((a) => a.codigo === '8.03');
    expect(motivoBloqueioRemocao(o, cob.id)).toMatch(/etapa 8/);
  });

  it('remove itens, redivide valores, remove atividade vazia redistribuindo na etapa, renumera ordem e ajusta a baseline', () => {
    const o = predio();
    const cob = locaisDeAndar(o).at(-1)!;
    const e8antes = o.etapas.find((e) => e.codigo === 8)!;
    const t = (a: Atividade) => somaC(a.itens.map((i) => i.valorOrcado));
    const v801 = t(ativ(o, '8.01'));
    const v802 = t(ativ(o, '8.02'));
    const v803 = t(ativ(o, '8.03'));
    const r = removerPavimento(o, cob.id);
    expect(r.locais.some((l) => l.id === cob.id)).toBe(false);
    expect(locaisDeAndar(r).map((l) => l.ordem)).toEqual([0, 1, 2, 3]);
    expect(r.etapas.flatMap((e) => e.atividades.flatMap((a) => a.itens)).some((i) => i.localId === cob.id)).toBe(false);
    // 8.03 sumiu; o valor dela foi para 8.01 e 8.02, proporcionalmente
    const e8 = r.etapas.find((e) => e.codigo === 8)!;
    expect(e8.atividades.map((a) => a.codigo)).toEqual(['8.01', '8.02']);
    const n801 = t(ativ(r, '8.01'));
    const n802 = t(ativ(r, '8.02'));
    expect(n801 + n802).toBe(v801 + v802 + v803);
    expect(Math.abs(n801 - (v801 + (v803 * v801) / (v801 + v802)))).toBeLessThanOrEqual(1);
    expect(e8.valorOrcado).toBe(e8antes.valorOrcado);
    expect(e8.predecessoras).toEqual(e8antes.predecessoras);
    // atividade por andar perdeu um item: total preservado, dividido igual
    const a1802 = ativ(r, '18.02');
    expect(t(a1802)).toBe(t(ativ(o, '18.02')));
    expect(new Set(a1802.itens.slice(0, -1).map((i) => i.valorOrcado)).size).toBe(1);
    // baseline
    const b = r.baselines[0].itens;
    for (const i of ativ(o, '8.03').itens) expect(b[i.id]).toBeUndefined();
    expect(a1802.itens.map((i) => b[i.id].valor)).toEqual(a1802.itens.map((i) => i.valorOrcado));
    expect(Object.keys(b).sort()).toEqual(r.etapas.flatMap((e) => e.atividades.flatMap((a) => a.itens.map((i) => i.id))).sort());
    expect(totalObra(r)).toBe(totalObra(o));
    expect(totalBase(r)).toBe(totalBase(o));
  });
});

describe('sincronizarBaselineEstrutura', () => {
  it('null sem baseline; mesma estrutura = mesmas entradas (datas planejadas novas não mexem na baseline)', () => {
    const semB = gerarObra(params('predio_3_6'), 'p');
    expect(sincronizarBaselineEstrutura(semB, semB)).toBeNull();
    const o = predio();
    const d = JSON.parse(JSON.stringify(o)) as Obra;
    d.etapas[0].atividades[0].itens[0].fimPlanejado = '2030-01-01';
    d.baselines = []; // a API não confia na baseline do corpo
    expect(sincronizarBaselineEstrutura(o, d)).toEqual(o.baselines[0]);
  });

  it('determinística: recalcular (antes, depois) dá a mesma baseline que a função de estrutura devolveu', () => {
    const o = predio();
    const passos: ((x: Obra) => Obra)[] = [
      (x) => dividirPorAndar(x, obraToda(x).id, ids()),
      (x) => juntarEmObraToda(x, ativ(x, '18.02').id, ids()),
      (x) => adicionarPavimento(x, { nome: 'N', tipo: 'pavimento', tipoPavimento: 'tipo', posicao: 2 }, ids()),
      (x) => removerPavimento(x, locaisDeAndar(x).at(-1)!.id),
    ];
    for (const f of passos) {
      const d = f(o);
      const corpo = { ...d, baselines: [{ ...d.baselines[0], itens: {} }] };
      expect(sincronizarBaselineEstrutura(o, corpo)).toEqual(d.baselines[0]);
    }
  });
});

describe('sincronizarAvancoEstrutura (avanço no PUT)', () => {
  /** Corpo como chegaria no PUT: avanço zerado/adulterado pelo cliente. */
  const zerar = (o: Obra) => {
    const c = JSON.parse(JSON.stringify(o)) as Obra;
    for (const e of c.etapas) for (const a of e.atividades) for (const i of a.itens) { i.percentual = 0; delete i.inicioReal; delete i.fimReal; }
    return c;
  };

  it('split: itens novos copiam % e real do original de antes (mesmo com o corpo zerado)', () => {
    const o = predio();
    const a0 = obraToda(o);
    Object.assign(a0.itens[0], { percentual: 100, inicioReal: '2026-01-06', fimReal: '2026-01-09' });
    const corpo = zerar(dividirPorAndar(o, a0.id, ids()));
    const r = sincronizarAvancoEstrutura(o, corpo);
    const a = r.etapas.flatMap((e) => e.atividades).find((x) => x.id === a0.id)!;
    for (const i of a.itens) expect(i).toMatchObject({ percentual: 100, inicioReal: '2026-01-06', fimReal: '2026-01-09' });
  });

  it('merge: % ponderado pelos valores de ANTES (corpo não manipula o peso), inicioReal menor, fimReal só se todos', () => {
    const o = predio();
    const a0 = ativ(o, '18.02');
    a0.itens.forEach((i, k) => { i.valorOrcado = k === 0 ? 300 : 100; i.percentual = k === 0 ? 100 : 0; i.fimReal = k === 0 ? '2026-05-08' : undefined; });
    a0.itens[1].inicioReal = '2026-05-11';
    a0.itens[0].inicioReal = '2026-05-04';
    const corpo = zerar(juntarEmObraToda(o, a0.id, ids()));
    corpo.etapas.flatMap((e) => e.atividades).find((x) => x.id === a0.id)!.itens[0].valorOrcado = 1; // não importa
    const r = sincronizarAvancoEstrutura(o, corpo);
    const it0 = r.etapas.flatMap((e) => e.atividades).find((x) => x.id === a0.id)!.itens[0];
    const totalV = 300 + 100 * (a0.itens.length - 1);
    expect(it0.percentual).toBe(Math.round(30000 / totalV));
    expect(it0.inicioReal).toBe('2026-05-04');
    expect(it0.fimReal).toBeUndefined();
    // a função de estrutura já mostra igual ao servidor
    const tela = ativ(juntarEmObraToda(o, a0.id, ids()), '18.02').itens[0];
    expect([tela.percentual, tela.inicioReal, tela.fimReal]).toEqual([it0.percentual, it0.inicioReal, it0.fimReal]);
  });

  it('andar novo: 0 sem real; itens já existentes copiam de antes; atividade que não mudou não é tocada', () => {
    const o = predio();
    const a0 = ativ(o, '18.01');
    Object.assign(a0.itens[0], { percentual: 50, inicioReal: '2026-04-01' });
    const corpo = adicionarPavimento(o, { nome: 'N', tipo: 'pavimento', tipoPavimento: 'tipo', posicao: 1 }, ids());
    const intocada = obraToda(corpo);
    intocada.itens[0].percentual = 77; // o PUT copia do banco antes; esta função não mexe
    const r = sincronizarAvancoEstrutura(o, corpo);
    const a = ativ(r, '18.01');
    const novo = a.itens.find((i) => i.id.startsWith('item-novo'))!;
    expect(novo.percentual).toBe(0);
    expect(novo.inicioReal).toBeUndefined();
    expect(a.itens.find((i) => i.id === a0.itens[0].id)).toMatchObject({ percentual: 50, inicioReal: '2026-04-01' });
    expect(obraToda(r).itens[0].percentual).toBe(77);
  });
});

describe('correções do teste geral (caso L4)', () => {
  it('juntar aceita 1 item num andar: volta para "obra toda" com id, %, real e baseline mantidos', () => {
    const o = predio();
    const a0 = obraToda(o);
    const [, l1] = locaisDeAndar(o);
    const div = dividirPorAndar(o, a0.id, ids(), [l1.id]);
    const it1 = div.etapas.flatMap((e) => e.atividades).find((x) => x.id === a0.id)!.itens[0];
    Object.assign(it1, { percentual: 30, inicioReal: '2026-02-02' });
    const r = juntarEmObraToda(div, a0.id, ids());
    const a = r.etapas.flatMap((e) => e.atividades).find((x) => x.id === a0.id)!;
    expect(a.itens).toEqual([{ ...it1, localId: a0.itens[0].localId }]);
    expect(r.baselines[0].itens[it1.id]).toEqual(div.baselines[0].itens[it1.id]);
    expect(r.baselines[0].itens).toEqual(o.baselines[0].itens);
    expect(() => juntarEmObraToda(r, a0.id, ids())).toThrow(/obra toda/);
  });

  it('último andar sem itens pode ser removido (obra volta a local único); com itens continua bloqueado', () => {
    const o = gerarObra(params('casa_terrea'), 'c');
    const com1 = adicionarPavimento(o, { nome: 'Superior', tipo: 'pavimento', tipoPavimento: 'tipo', posicao: 0 }, ids());
    const l = locaisDeAndar(com1)[0];
    expect(motivoBloqueioRemocao(com1, l.id)).toBeNull();
    const r = removerPavimento(com1, l.id);
    expect(locaisDeAndar(r)).toHaveLength(0);
    expect(r.locais.map((x) => x.tipo)).toEqual(['obra']);
    expect(JSON.stringify(r.etapas)).toBe(JSON.stringify(o.etapas));
    // com um item no andar, volta a bloquear
    const comItem = dividirPorAndar(com1, obraToda(com1).id, ids());
    expect(motivoBloqueioRemocao(comItem, l.id)).toMatch(/último andar/);
  });
});
