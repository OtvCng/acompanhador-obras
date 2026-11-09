/**
 * STORE MOCK (contrato). Dono da implementação: Fundação.
 * Sem banco (Q3): estado em memória + localStorage (chave 'obras:v1'), com "Restaurar dados de exemplo".
 * As telas usam SÓ estes hooks; nunca mexem em localStorage diretamente.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Obra, Usuario, Perfil, ParametrosNovaObra, ISODate, ModeloObra, TipoObra, Apontamento } from '@obras/shared';
import { MODELOS, gerarObra, congelarBaseline as congelarBaselineObra } from '@obras/shared';
import { criarSeed, HOJE_SEED, USUARIOS } from '@/data/seed';

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

  /** Modelos editáveis (Q12). Começam como cópia de MODELOS; edição persiste no localStorage. */
  modelos: Record<TipoObra, ModeloObra>;
  atualizarModelo: (m: ModeloObra) => void;
  restaurarModelos: () => void;
}

const Ctx = createContext<ObrasStore | null>(null);

// ---------------------------------------------------------------------------
// Persistência
// ---------------------------------------------------------------------------
const CHAVE_OBRAS = 'obras:v1';
const CHAVE_MODELOS = 'obras:modelos:v1';
const VERSAO = 1;

interface EstadoSalvo { versao: number; obras: Obra[]; usuarioAtualId: string; hoje: ISODate }
interface ModelosSalvos { versao: number; modelos: Record<TipoObra, ModeloObra> }

const TIPOS = Object.keys(MODELOS) as TipoObra[];
const copiaModelos = (): Record<TipoObra, ModeloObra> => JSON.parse(JSON.stringify(MODELOS));

function ler<T>(chave: string): T | null {
  try {
    const bruto = window.localStorage.getItem(chave);
    return bruto ? (JSON.parse(bruto) as T) : null;
  } catch {
    return null;
  }
}
function gravar(chave: string, valor: unknown) {
  try {
    window.localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    /* cota cheia ou storage bloqueado: segue só em memória */
  }
}

function estadoInicial(): EstadoSalvo {
  const s = ler<EstadoSalvo>(CHAVE_OBRAS);
  const valido =
    s && s.versao === VERSAO && Array.isArray(s.obras) && typeof s.hoje === 'string' &&
    s.obras.every((o) => o && typeof o.id === 'string' && Array.isArray(o.etapas) && Array.isArray(o.baselines) && Array.isArray(o.apontamentos));
  if (valido) return s;
  return { versao: VERSAO, obras: criarSeed(HOJE_SEED), usuarioAtualId: USUARIOS[0].id, hoje: HOJE_SEED };
}

function modelosIniciais(): Record<TipoObra, ModeloObra> {
  const s = ler<ModelosSalvos>(CHAVE_MODELOS);
  if (s && s.versao === VERSAO && s.modelos && TIPOS.every((t) => s.modelos[t] && Array.isArray(s.modelos[t].atividades))) {
    return s.modelos;
  }
  return copiaModelos();
}

let contadorId = 0;
const novoId = (prefixo: string) => `${prefixo}-${Date.now().toString(36)}${(contadorId++).toString(36)}`;

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function ObrasProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoSalvo>(estadoInicial);
  const [modelos, setModelos] = useState<Record<TipoObra, ModeloObra>>(modelosIniciais);
  // Ref com o estado mais recente, para os métodos lerem usuário/hoje sem recriar callbacks.
  const ref = useRef(estado);
  ref.current = estado;

  useEffect(() => { gravar(CHAVE_OBRAS, estado); }, [estado]);
  useEffect(() => { gravar(CHAVE_MODELOS, { versao: VERSAO, modelos } satisfies ModelosSalvos); }, [modelos]);

  const usuarioAtual = USUARIOS.find((u) => u.id === estado.usuarioAtualId) ?? USUARIOS[0];

  const mudarObra = useCallback((obraId: string, fn: (o: Obra) => Obra) => {
    setEstado((s) => ({ ...s, obras: s.obras.map((o) => (o.id === obraId ? fn(o) : o)) }));
  }, []);

  const setUsuarioAtual = useCallback((id: string) => {
    if (USUARIOS.some((u) => u.id === id)) setEstado((s) => ({ ...s, usuarioAtualId: id }));
  }, []);
  const setHoje = useCallback((d: ISODate) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) setEstado((s) => ({ ...s, hoje: d }));
  }, []);

  const criarObra = useCallback((p: ParametrosNovaObra): Obra => {
    const obra = gerarObra(p, novoId('obra'), modelos[p.tipo] ?? MODELOS[p.tipo]);
    setEstado((s) => ({ ...s, obras: [...s.obras, obra] }));
    return obra;
  }, [modelos]);

  const atualizarObra = useCallback((obra: Obra) => mudarObra(obra.id, () => obra), [mudarObra]);

  /** Lança erro (sem alterar nada) se for v2+ sem justificativa ou se a obra não existir. */
  const congelarBaseline = useCallback((obraId: string, justificativa?: string) => {
    const { obras, usuarioAtualId, hoje } = ref.current;
    const obra = obras.find((o) => o.id === obraId);
    if (!obra) throw new Error('Obra não encontrada.');
    const nova = congelarBaselineObra(obra, usuarioAtualId, hoje, justificativa);
    mudarObra(obraId, () => nova);
  }, [mudarObra]);

  const lancarApontamento = useCallback<ObrasStore['lancarApontamento']>((a) => {
    const { obras, usuarioAtualId, hoje } = ref.current;
    const obra = obras.find((o) => o.id === a.obraId);
    if (!obra) throw new Error('Obra não encontrada.');
    const existe = obra.etapas.some((e) => e.atividades.some((at) => at.itens.some((i) => i.id === a.itemId)));
    if (!existe) throw new Error('Item não encontrado nesta obra.');
    const novo = Math.max(0, Math.min(100, Math.round(a.percentualNovo)));
    mudarObra(a.obraId, (o) => {
      let anterior = 0;
      const etapas = o.etapas.map((e) => ({
        ...e,
        atividades: e.atividades.map((at) => ({
          ...at,
          itens: at.itens.map((i) => {
            if (i.id !== a.itemId) return i;
            anterior = i.percentual;
            const item = { ...i, percentual: novo };
            if (novo > 0 && !item.inicioReal) item.inicioReal = hoje;
            if (novo === 0) delete item.inicioReal;
            if (novo >= 100) item.fimReal = item.fimReal && i.percentual >= 100 ? item.fimReal : hoje;
            else delete item.fimReal;
            return item;
          }),
        })),
      }));
      const apontamento: Apontamento = {
        id: novoId('ap'),
        itemId: a.itemId,
        data: hoje,
        percentualAnterior: anterior,
        percentualNovo: novo,
        ...(a.observacao?.trim() ? { observacao: a.observacao.trim() } : {}),
        fotos: a.fotos ?? [],
        autorId: usuarioAtualId,
      };
      const todos = etapas.flatMap((e) => e.atividades.flatMap((at) => at.itens));
      const tudoPronto = todos.length > 0 && todos.every((i) => i.percentual >= 100);
      let status = o.status;
      if (tudoPronto) status = 'concluida';
      else if (o.status === 'concluida' || (o.status === 'planejamento' && novo > 0)) status = 'em_andamento';
      return { ...o, etapas, status, apontamentos: [...o.apontamentos, apontamento] };
    });
  }, [mudarObra]);

  const restaurarExemplos = useCallback(() => {
    setEstado((s) => ({ versao: VERSAO, obras: criarSeed(HOJE_SEED), usuarioAtualId: s.usuarioAtualId, hoje: HOJE_SEED }));
  }, []);

  const atualizarModelo = useCallback((m: ModeloObra) => setModelos((ms) => ({ ...ms, [m.tipo]: m })), []);
  const restaurarModelos = useCallback(() => setModelos(copiaModelos()), []);

  const value = useMemo<ObrasStore>(() => ({
    obras: estado.obras,
    usuarios: USUARIOS,
    usuarioAtual,
    setUsuarioAtual,
    hoje: estado.hoje,
    setHoje,
    criarObra,
    atualizarObra,
    congelarBaseline,
    lancarApontamento,
    restaurarExemplos,
    modelos,
    atualizarModelo,
    restaurarModelos,
  }), [estado.obras, estado.hoje, usuarioAtual, setUsuarioAtual, setHoje, criarObra, atualizarObra, congelarBaseline,
    lancarApontamento, restaurarExemplos, modelos, atualizarModelo, restaurarModelos]);

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
