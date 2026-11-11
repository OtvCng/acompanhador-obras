/**
 * DADOS DE EXEMPLO (fictícios). Dono: Fundação.
 * 6 obras, uma por tipo, geradas com gerarObra + baseline congelada + apontamentos simulados.
 * Em HOJE_SEED (2026-11-07) os estados ficam: 1 adiantada, 2 no prazo, 1 atenção, 1 atrasada (alerta Caixa), 1 concluída.
 * Nomes de pessoas, obras e endereços são inventados.
 */
import type { Apontamento, ISODate, Obra, ParametrosNovaObra, Usuario } from '@obras/shared';
import {
  addDiasUteis, ajustarValorEtapa, congelarBaseline, contarDiasUteis, desviosParaJustificar, diaDaSemana, ehDiaUtil, gerarObra,
  proximoDiaUtil, addDias,
} from '@obras/shared';

export const HOJE_SEED: ISODate = '2026-11-07';

export const USUARIOS: Usuario[] = [
  { id: 'u-diretor', nome: 'Roberto Fictício', perfil: 'diretor' },
  { id: 'u-eng-carla', nome: 'Carla Exemplo', perfil: 'engenheiro' },
  { id: 'u-eng-bruno', nome: 'Bruno Modelo', perfil: 'engenheiro' },
  { id: 'u-enc-ze', nome: 'Zé Demonstração', perfil: 'encarregado' },
  { id: 'u-enc-tiao', nome: 'Tião Amostra', perfil: 'encarregado' },
  { id: 'u-enc-lucia', nome: 'Lúcia Teste', perfil: 'encarregado' },
];

/** Gerador pseudoaleatório determinístico (mulberry32) para a demo ser reproduzível. */
function rng(semente: number) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const OBSERVACOES = [
  'Serviço liberado pelo engenheiro.',
  'Equipe completa no dia.',
  'Chuva pela manhã, serviço retomado à tarde.',
  'Material entregue e aplicado.',
  'Conferência de prumo e nível feita.',
  'Aguardando secagem para a próxima etapa.',
  'Frente de serviço reduzida por falta de servente.',
  'Concretagem acompanhada pelo laboratório.',
];

const diasCorridos = (a: ISODate, b: ISODate) =>
  Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86_400_000);

interface Simulacao {
  /** Fator de ritmo real: < 1 adiantado, > 1 atrasado (estica o calendário da baseline vigente). */
  k: number;
  hoje: ISODate;
  semente: number;
}

/**
 * Simula o histórico de apontamentos: cada item começa e termina na data da baseline vigente esticada por k,
 * com um apontamento por semana (sexta) enquanto está em execução e um de 100% no fim real.
 */
function simular(obra: Obra, s: Simulacao): Obra {
  const b = obra.baselines.at(-1)!;
  const r = rng(s.semente);
  const apontamentos: Apontamento[] = [];
  let seq = 0;
  let fotoSeq = 0;
  const etapas = obra.etapas.map((e) => ({
    ...e,
    atividades: e.atividades.map((a) => ({
      ...a,
      itens: a.itens.map((it) => {
        const bi = b.itens[it.id];
        if (!bi) return it;
        const ini = proximoDiaUtil(addDias(obra.dataInicio, Math.round(diasCorridos(obra.dataInicio, bi.inicio) * s.k)));
        let fim = proximoDiaUtil(addDias(obra.dataInicio, Math.round(diasCorridos(obra.dataInicio, bi.fim) * s.k)));
        if (fim < ini) fim = ini;
        if (ini > s.hoje) return it;
        const total = contarDiasUteis(ini, fim);
        const datas: ISODate[] = [];
        for (let d = ini; d < fim && d <= s.hoje; d = addDias(d, 1)) {
          if (diaDaSemana(d) === 5 && ehDiaUtil(d)) datas.push(d);
        }
        if (fim <= s.hoje) datas.push(fim);
        let anterior = 0;
        for (const d of datas) {
          const bruto = d >= fim ? 100 : (contarDiasUteis(ini, d) / total) * 100;
          const novo = d >= fim ? 100 : Math.min(95, Math.max(5, Math.round(bruto / 5) * 5));
          if (novo <= anterior) continue;
          const autorId = r() < 0.15 ? obra.engenheiroId : obra.encarregadoId;
          const fotos = r() < 0.2 ? [`foto-${obra.id}-${String(++fotoSeq).padStart(3, '0')}.jpg`] : [];
          const observacao = r() < 0.25 ? OBSERVACOES[Math.floor(r() * OBSERVACOES.length)] : undefined;
          apontamentos.push({
            id: `${obra.id}-ap${++seq}`, itemId: it.id, data: d, percentualAnterior: anterior, percentualNovo: novo,
            ...(observacao ? { observacao } : {}), fotos, autorId,
          });
          anterior = novo;
        }
        if (anterior === 0) return it;
        return { ...it, percentual: anterior, inicioReal: ini, ...(anterior >= 100 ? { fimReal: fim } : {}) };
      }),
    })),
  }));
  apontamentos.sort((x, y) => (x.data < y.data ? -1 : x.data > y.data ? 1 : 0));
  return { ...obra, etapas, apontamentos };
}

/** Replanejamento: adia em `dias` úteis tudo que ainda não terminou em `data`. */
function replanejar(obra: Obra, data: ISODate, dias: number): Obra {
  return {
    ...obra,
    etapas: obra.etapas.map((e) => ({
      ...e,
      atividades: e.atividades.map((a) => ({
        ...a,
        itens: a.itens.map((i) => {
          if (i.fimPlanejado < data) return i;
          return {
            ...i,
            inicioPlanejado: i.inicioPlanejado >= data ? addDiasUteis(i.inicioPlanejado, dias) : i.inicioPlanejado,
            fimPlanejado: addDiasUteis(i.fimPlanejado, dias),
          };
        }),
      })),
    })),
  };
}

const ENG_CARLA = 'u-eng-carla';
const ENG_BRUNO = 'u-eng-bruno';
const ENC_ZE = 'u-enc-ze';
const ENC_TIAO = 'u-enc-tiao';
const ENC_LUCIA = 'u-enc-lucia';

function base(p: Omit<ParametrosNovaObra, 'endereco'> & { endereco?: string }): ParametrosNovaObra {
  return { endereco: 'Rua Fictícia, 100', ...p };
}

export function criarSeed(hoje: ISODate = HOJE_SEED): Obra[] {
  const diretor = 'u-diretor';
  const obras: Obra[] = [];

  // 1) Casa térrea: CONCLUÍDA
  {
    let o = gerarObra(base({
      nome: 'Residência Exemplo Azambuja', tipo: 'casa_terrea', endereco: 'Rua das Hortênsias Fictícias, 120',
      cidade: 'Brusque', areaM2: 142, dataInicio: '2025-09-01', orcamentoTotal: 520_000,
      engenheiroId: ENG_CARLA, encarregadoId: ENC_ZE,
    }), 'obra-casa');
    o = congelarBaseline(o, diretor, '2025-08-29');
    o = simular(o, { k: 1.05, hoje, semente: 11 });
    obras.push({ ...o, status: 'concluida' });
  }

  // 2) Geminadas: ATRASADA (desvio > 10 pp, alerta Caixa)
  {
    let o = gerarObra(base({
      nome: 'Geminadas Exemplo Guabiruba', tipo: 'geminadas', endereco: 'Rua Modelo do Lageado, 45',
      cidade: 'Guabiruba', areaM2: 4 * 68, dataInicio: '2026-06-01', orcamentoTotal: 1_180_000, unidades: 4,
      engenheiroId: ENG_BRUNO, encarregadoId: ENC_TIAO,
    }), 'obra-geminadas');
    o = congelarBaseline(o, diretor, '2026-05-29');
    o = simular(o, { k: 1.2, hoje, semente: 22 });
    obras.push(o);
  }

  // 3) Sobrado: ADIANTADA
  {
    let o = gerarObra(base({
      nome: 'Sobrado Exemplo Gaspar', tipo: 'sobrado', endereco: 'Rua Imaginária do Bela Vista, 310',
      cidade: 'Gaspar', areaM2: 215, dataInicio: '2026-07-06', orcamentoTotal: 840_000,
      engenheiroId: ENG_CARLA, encarregadoId: ENC_LUCIA,
    }), 'obra-sobrado');
    o = congelarBaseline(o, diretor, '2026-07-03');
    o = simular(o, { k: 0.94, hoje, semente: 33 });
    obras.push(o);
  }

  // 4) Prédio 3-6: NO PRAZO, com uma alteração de prazo justificada no histórico.
  // Baseline inicial fixa (plano 2026-11-11-15-05): o replanejamento não vira v2; adia só o que vem
  // daqui a 3 semanas e fica registrado com justificativa, então o "no prazo" de hoje continua valendo.
  {
    let o = gerarObra(base({
      nome: 'Edifício Exemplo Santa Terezinha', tipo: 'predio_3_6', endereco: 'Avenida Fictícia, 1500',
      cidade: 'Brusque', areaM2: 1_640, dataInicio: '2026-03-02', orcamentoTotal: 6_200_000,
      engenheiroId: ENG_BRUNO, encarregadoId: ENC_ZE,
    }), 'obra-predio36');
    o = congelarBaseline(o, diretor, '2026-02-27');
    o = simular(o, { k: 1.0, hoje, semente: 44 });
    const antes = o;
    o = replanejar(o, addDiasUteis(hoje, 15), 8);
    const itens = desviosParaJustificar(antes, o);
    if (itens.length) {
      o = {
        ...o,
        alteracoes: [{
          id: 'alt-exemplo-predio36', data: addDias(hoje, -2), autorId: ENG_BRUNO, itens,
          justificativa: 'Atraso na entrega das esquadrias pelo fornecedor. Etapas finais adiadas em 8 dias úteis, aprovado pela diretoria.',
        }],
      };
    }
    obras.push(o);
  }

  // 5) Prédio 7+: NO PRAZO
  {
    let o = gerarObra(base({
      nome: 'Torre Exemplo Centro', tipo: 'predio_7_mais', endereco: 'Rua Hipotética, 800',
      cidade: 'Itajaí', areaM2: 5_400, dataInicio: '2026-01-05', orcamentoTotal: 18_500_000,
      engenheiroId: ENG_CARLA, encarregadoId: ENC_TIAO,
    }), 'obra-predio7');
    o = congelarBaseline(o, diretor, '2025-12-30');
    o = simular(o, { k: 1.01, hoje, semente: 55 });
    obras.push(o);
  }

  // 6) Comercial: ATENÇÃO, com Serviços preliminares editados para 5,5% (terraplenagem e PPCI do galpão),
  //    acima da faixa Caixa (1,13 a 3,97%). Editado com manterTotal = false: o orçamento total sobe e as outras
  //    etapas não mudam de valor, então só esta etapa fica fora da faixa. A supraestrutura não serve para o
  //    exemplo: qualquer valor acima de 17,67% empurra as etapas 16, 17 e 18 (faixas estreitas) abaixo do mínimo.
  {
    let o = gerarObra(base({
      nome: 'Galpão Comercial Exemplo', tipo: 'comercial', endereco: 'Rodovia Fictícia, km 12',
      cidade: 'São João Batista', areaM2: 1_200, dataInicio: '2026-06-01', orcamentoTotal: 2_100_000,
      engenheiroId: ENG_BRUNO, encarregadoId: ENC_LUCIA,
    }), 'obra-comercial');
    {
      const alvo = 0.055; // participação final da etapa 1 no novo total
      const atual = o.etapas.find((e) => e.codigo === 1)!.valorOrcado;
      o = ajustarValorEtapa(o, 1, (alvo * (o.orcamentoTotal - atual)) / (1 - alvo), false);
    }
    o = congelarBaseline(o, diretor, '2026-05-29');
    o = simular(o, { k: 1.045, hoje, semente: 66 });
    obras.push(o);
  }

  return obras;
}
