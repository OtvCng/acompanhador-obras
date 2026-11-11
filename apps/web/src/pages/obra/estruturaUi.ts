/**
 * Apoio das telas de estrutura por andar (Levas 2 e 3, plano 2026-11-11-17-30).
 * As regras ficam em @obras/shared (estrutura.ts); aqui só o que as telas precisam em comum.
 */
import type { Local, NovoId, Obra } from '@obras/shared';

/** Mesmo formato de id do store: `${prefixo}-${uuid}`. */
export const novoIdWeb: NovoId = (prefixo) => `${prefixo}-${crypto.randomUUID()}`;

export const AVISO_PENDENTE = 'Salve ou descarte as alterações do cronograma antes.';

/** Roda uma função de estrutura sem derrubar a tela: devolve o resultado ou a mensagem do erro. */
export function tentar<T>(f: () => T): { ok: true; valor: T } | { ok: false; erro: string } {
  try {
    return { ok: true, valor: f() };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Erro inesperado.' };
  }
}

/** Andares/unidades da obra (sem o local "Obra toda"), de baixo para cima. */
export function andaresDaObra(obra: Obra): Local[] {
  return obra.locais.filter((l) => l.tipo !== 'obra').sort((a, b) => a.ordem - b.ordem);
}

/** Contagem de itens e atividades (com item) da obra, para mostrar o que uma ação cria ou remove. */
export function contarEstrutura(obra: Obra): { itens: number; atividades: number } {
  let itens = 0;
  let atividades = 0;
  for (const e of obra.etapas)
    for (const a of e.atividades) {
      itens += a.itens.length;
      if (a.itens.length) atividades++;
    }
  return { itens, atividades };
}

/** Palavras do andar/unidade para os textos, já com a concordância (unidade é feminino). */
export const nomeAndar = (obra: Obra) =>
  obra.tipo === 'geminadas'
    ? { um: 'unidade', varios: 'unidades', Titulo: 'Unidades', umArtigo: 'uma unidade', doVizinho: 'da unidade vizinha', oPrimeiro: 'a primeira unidade', marcado: 'marcada', outros: 'outras', cada: 'cada uma' }
    : { um: 'andar', varios: 'andares', Titulo: 'Andares', umArtigo: 'um andar', doVizinho: 'do andar vizinho', oPrimeiro: 'o primeiro andar', marcado: 'marcado', outros: 'outros', cada: 'cada um' };
