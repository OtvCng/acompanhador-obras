/**
 * STORE MOCK (contrato). Dono da implementação: Fundação.
 * Sem banco (Q3): estado em memória + localStorage (chave 'obras:v1'), com "Restaurar dados de exemplo".
 * As telas usam SÓ estes hooks; nunca mexem em localStorage diretamente.
 */
import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Obra, Usuario, Perfil, ParametrosNovaObra, ISODate } from '@obras/shared';

export interface ObrasStore {
  obras: Obra[];
  usuarios: Usuario[];
  /** Usuário simulado (Q5). O seletor no topo troca este usuário. */
  usuarioAtual: Usuario;
  setUsuarioAtual: (id: string) => void;
  /** "Hoje" do sistema. Fixo nos dados de exemplo para a demo ser reproduzível; editável na Topbar. */
  hoje: ISODate;
  setHoje: (d: ISODate) => void;

  criarObra: (p: ParametrosNovaObra) => Obra;
  atualizarObra: (obra: Obra) => void;
  congelarBaseline: (obraId: string, justificativa?: string) => void;
  lancarApontamento: (a: { obraId: string; itemId: string; percentualNovo: number; observacao?: string; fotos?: string[] }) => void;
  restaurarExemplos: () => void;
}

const Ctx = createContext<ObrasStore | null>(null);

const USUARIO_PADRAO: Usuario = { id: 'u-diretor', nome: 'Diretor', perfil: 'diretor' };

export function ObrasProvider({ children }: { children: ReactNode }) {
  // STUB: Fundação substitui por implementação real com seed e localStorage.
  const [usuarioAtual, setU] = useState<Usuario>(USUARIO_PADRAO);
  const [hoje, setHoje] = useState<ISODate>('2026-11-07');
  const nao = () => { throw new Error('store: não implementado'); };
  const value: ObrasStore = {
    obras: [],
    usuarios: [USUARIO_PADRAO],
    usuarioAtual,
    setUsuarioAtual: () => setU(USUARIO_PADRAO),
    hoje,
    setHoje,
    criarObra: nao,
    atualizarObra: nao,
    congelarBaseline: nao,
    lancarApontamento: nao,
    restaurarExemplos: nao,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useObras(): ObrasStore {
  const v = useContext(Ctx);
  if (!v) throw new Error('useObras fora do ObrasProvider');
  return v;
}

export function useObra(id: string | undefined): Obra | undefined {
  return useObras().obras.find((o) => o.id === id);
}

/** Obras visíveis ao usuário atual: diretor vê todas; engenheiro/encarregado só as suas. */
export function useObrasVisiveis(): Obra[] {
  const { obras, usuarioAtual } = useObras();
  if (usuarioAtual.perfil === 'diretor') return obras;
  const campo: keyof Obra = usuarioAtual.perfil === 'engenheiro' ? 'engenheiroId' : 'encarregadoId';
  return obras.filter((o) => o[campo] === usuarioAtual.id);
}

export function podeVerValores(perfil: Perfil): boolean {
  return perfil !== 'encarregado';
}
