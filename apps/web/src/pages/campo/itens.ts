import { planejadoItem, type Atividade, type EtapaObra, type ISODate, type ItemAtividade, type Local, type Obra } from '@obras/shared';
import { somarDiasCorridos } from '@/components/campo/formatos';

export interface ItemCampo {
  item: ItemAtividade;
  atividade: Atividade;
  etapa: EtapaObra;
  local: Local | undefined;
  /** Planejado até hoje contra a baseline (0..100). */
  planejado: number;
}

export interface GruposCampo {
  andamento: ItemCampo[];
  proximos: ItemCampo[];
  atrasados: ItemCampo[];
  concluidos: ItemCampo[];
}

/** Tolerância (pontos percentuais) para não chamar de atrasado um item que está só arredondando. */
const TOLERANCIA_PP = 0.5;

function planejadoSeguro(obra: Obra, itemId: string, hoje: ISODate): number {
  try {
    return Math.max(0, Math.min(100, planejadoItem(obra, itemId, hoje) * 100));
  } catch {
    return 0;
  }
}

export function itensDaObra(obra: Obra, hoje: ISODate): ItemCampo[] {
  const locais = new Map(obra.locais.map((l) => [l.id, l]));
  return obra.etapas.flatMap((etapa) =>
    etapa.atividades.flatMap((atividade) =>
      atividade.itens.map((item) => ({ item, atividade, etapa, local: locais.get(item.localId), planejado: planejadoSeguro(obra, item.id, hoje) })),
    ),
  );
}

/**
 * Agrupa os itens para o encarregado:
 * - Concluídos: 100%.
 * - Atrasados: planejado até hoje maior que o realizado.
 * - Em andamento: começou (tem avanço) ou está dentro da janela planejada.
 * - Começam nos próximos 7 dias: ainda sem avanço e com início entre amanhã e hoje + 7 dias corridos.
 * Itens futuros além de 7 dias ficam fora da lista.
 */
export function agruparItens(itens: ItemCampo[], hoje: ISODate): GruposCampo {
  const limite = somarDiasCorridos(hoje, 7);
  const g: GruposCampo = { andamento: [], proximos: [], atrasados: [], concluidos: [] };
  for (const x of itens) {
    const { item } = x;
    if (item.percentual >= 100) g.concluidos.push(x);
    else if (x.planejado - item.percentual > TOLERANCIA_PP) g.atrasados.push(x);
    else if (item.percentual > 0 || (item.inicioPlanejado <= hoje && item.fimPlanejado >= hoje)) g.andamento.push(x);
    else if (item.inicioPlanejado > hoje && item.inicioPlanejado <= limite) g.proximos.push(x);
  }
  const porInicio = (a: ItemCampo, b: ItemCampo) => a.item.inicioPlanejado.localeCompare(b.item.inicioPlanejado) || a.atividade.codigo.localeCompare(b.atividade.codigo);
  g.andamento.sort(porInicio);
  g.proximos.sort(porInicio);
  g.atrasados.sort((a, b) => b.planejado - b.item.percentual - (a.planejado - a.item.percentual));
  g.concluidos.sort((a, b) => (b.item.fimReal ?? b.item.fimPlanejado).localeCompare(a.item.fimReal ?? a.item.fimPlanejado));
  return g;
}

/** Próximo número livre para nome de foto fake do dia: foto-AAAA-MM-DD-N.jpg. */
export function proximoNumeroFoto(obra: Obra, hoje: ISODate, jaNaFolha: string[]): number {
  const prefixo = `foto-${hoje}-`;
  const usados = [...obra.apontamentos.flatMap((a) => a.fotos), ...jaNaFolha]
    .filter((f) => f.startsWith(prefixo))
    .map((f) => Number(f.slice(prefixo.length).replace(/\.jpg$/, '')))
    .filter((n) => Number.isFinite(n));
  return usados.length ? Math.max(...usados) + 1 : 1;
}
