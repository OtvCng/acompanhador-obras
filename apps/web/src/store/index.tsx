/**
 * STORE com API + Postgres (plano docs/planejamento/2026-11-09-14-47-banco-postgres-api.md).
 * Mantém a MESMA interface do store mock: as telas não sabem que existe servidor.
 *
 * Como funciona:
 * - Login obrigatório: sem sessão, o Provider mostra a tela de login no lugar do app.
 * - Cada mudança é aplicada na hora na tela (otimista) e entra numa fila POR OBRA, enviada em ordem.
 *   "Criar" e "gravar" seguidos são juntados: o envio sempre manda a versão mais recente da obra.
 * - Se o servidor recusar, aparece um toast e a obra é recarregada do servidor.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import type { Obra, Usuario, Perfil, ParametrosNovaObra, ISODate, ModeloObra, TipoObra, Gasto, NovoGasto, EdicaoGasto, ResultadoImportacao } from '@obras/shared';
import { MODELOS, OCULTAR_VALORES_ENCARREGADO, gerarObra, congelarBaseline as congelarBaselineObra, aplicarApontamento } from '@obras/shared';
import { api, ErroApi, hojeLocal, mensagemErro } from '@/lib/api';
import LoginPage from '@/pages/LoginPage';

export interface ObrasStore {
  obras: Obra[];
  usuarios: Usuario[];
  /** Usuário logado. */
  usuarioAtual: Usuario;
  /** Mantido por compatibilidade; com login real não troca de usuário. */
  setUsuarioAtual: (id: string) => void;
  /** Data de referência dos cálculos na tela. Começa na data real; os apontamentos usam a data do servidor. */
  hoje: ISODate;
  setHoje: (d: ISODate) => void;

  criarObra: (p: ParametrosNovaObra) => Obra;
  /** `justificativa`: obrigatória quando o save muda prazo > 5 d.u. da baseline inicial (a API confere). */
  atualizarObra: (obra: Obra, opcoes?: { justificativa?: string }) => void;
  congelarBaseline: (obraId: string, justificativa?: string) => void;
  lancarApontamento: (a: { obraId: string; itemId: string; percentualNovo: number; observacao?: string; fotos?: string[] }) => void;
  /** Diretor: recria só as obras de exemplo no servidor. */
  restaurarExemplos: () => void;

  modelos: Record<TipoObra, ModeloObra>;
  atualizarModelo: (m: ModeloObra) => void;
  restaurarModelos: () => void;
  /** Volta UM modelo ao padrão do código (apaga a versão editada no servidor). */
  restaurarModelo: (tipo: TipoObra) => void;

  // --- Novos com o banco ---
  /** true enquanto há alterações esperando o servidor. */
  sincronizando: boolean;
  sair: () => Promise<void>;
  recarregar: () => Promise<void>;
  recarregarUsuarios: () => Promise<void>;
  excluirObra: (obraId: string) => Promise<void>;

  // --- Financeiro: gastos reais (plano 2026-11-10) ---
  /** Lança um gasto (otimista; fila por obra). Devolve o gasto com id provisório. */
  lancarGasto: (g: NovoGasto) => Gasto;
  /** Edita campos de um gasto (otimista; fila por obra). */
  editarGasto: (id: string, parcial: EdicaoGasto) => void;
  /** Exclui um gasto (otimista; fila por obra). */
  excluirGasto: (id: string) => void;
  /** Envia as linhas da planilha; o servidor revalida e grava só as válidas (tudo ou nada). Recarrega a obra. */
  importarGastos: (obraId: string, linhas: Record<string, string>[]) => Promise<ResultadoImportacao>;
  /** Desfaz um lote importado inteiro. Recarrega a obra. */
  desfazerImportacao: (obraId: string, importacaoId: string) => Promise<void>;
}

const Ctx = createContext<ObrasStore | null>(null);

type Operacao =
  | { tipo: 'criar' }
  | { tipo: 'gravar'; justificativa?: string }
  | { tipo: 'baseline'; justificativa?: string }
  | { tipo: 'apontamento'; itemId: string; percentualNovo: number; observacao?: string; fotos?: string[] }
  | { tipo: 'gasto_novo'; gasto: Gasto }
  | { tipo: 'gasto_editar'; id: string; parcial: Record<string, unknown> }
  | { tipo: 'gasto_excluir'; id: string }
  | { tipo: 'gasto_importar'; linhas: Record<string, string>[]; ok: (r: ResultadoImportacao) => void; falha: (e: unknown) => void }
  | { tipo: 'gasto_desfazer'; importacaoId: string; ok: () => void; falha: (e: unknown) => void };

/** Operações com promessa própria: o erro vai para quem chamou (a tela mostra), sem o toast genérico. */
const comRetorno = (op: Operacao): op is Extract<Operacao, { tipo: 'gasto_importar' | 'gasto_desfazer' }> =>
  op.tipo === 'gasto_importar' || op.tipo === 'gasto_desfazer';

const copiaModelos = (): Record<TipoObra, ModeloObra> => JSON.parse(JSON.stringify(MODELOS));
const novoId = (prefixo: string) => `${prefixo}-${crypto.randomUUID()}`;

// ---------------------------------------------------------------------------
// Provider: sessão
// ---------------------------------------------------------------------------
export function ObrasProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null | undefined>(undefined); // undefined = verificando

  useEffect(() => {
    api<{ usuario: Usuario }>('GET', '/auth/me')
      .then((r) => setUsuario(r.usuario))
      .catch((e) => {
        if (!(e instanceof ErroApi && e.status === 401)) toast.error(mensagemErro(e));
        setUsuario(null);
      });
  }, []);

  if (usuario === undefined) return <TelaCarregando texto="Verificando acesso..." />;
  if (usuario === null) return <LoginPage aoEntrar={setUsuario} />;
  return <ProviderLogado key={usuario.id} usuario={usuario} aoSair={() => setUsuario(null)}>{children}</ProviderLogado>;
}

function TelaCarregando({ texto }: { texto: string }) {
  return <div className="flex min-h-screen items-center justify-center bg-gray-50 text-sm text-muted">{texto}</div>;
}

// ---------------------------------------------------------------------------
// Provider: dados do usuário logado
// ---------------------------------------------------------------------------
function ProviderLogado({ usuario, aoSair, children }: { usuario: Usuario; aoSair: () => void; children: ReactNode }) {
  const [obras, setObras] = useState<Obra[] | null>(null);
  const [usuarios, setUsuarios] = useState<Usuario[]>([usuario]);
  const [modelos, setModelos] = useState<Record<TipoObra, ModeloObra>>(copiaModelos);
  const [hoje, setHojeEstado] = useState<ISODate>(hojeLocal);
  const [pendentes, setPendentes] = useState(0);
  const [erroCarga, setErroCarga] = useState<string | null>(null);

  // Cópia síncrona das obras: as mutações do mesmo clique (ex.: criar + atualizar no wizard) leem a versão mais nova.
  const obrasRef = useRef<Obra[]>([]);
  const filas = useRef(new Map<string, Operacao[]>());
  const rodando = useRef(new Set<string>());

  const publicar = useCallback((lista: Obra[]) => { obrasRef.current = lista; setObras(lista); }, []);
  const trocarObra = useCallback((obra: Obra) => {
    const lista = obrasRef.current.some((o) => o.id === obra.id)
      ? obrasRef.current.map((o) => (o.id === obra.id ? obra : o))
      : [...obrasRef.current, obra];
    publicar(lista);
  }, [publicar]);

  const recarregarUsuarios = useCallback(async () => {
    setUsuarios(await api<Usuario[]>('GET', '/usuarios'));
  }, []);

  const recarregar = useCallback(async () => {
    const [os, us, ms] = await Promise.all([
      api<Obra[]>('GET', '/obras'),
      api<Usuario[]>('GET', '/usuarios'),
      api<Record<TipoObra, ModeloObra>>('GET', '/modelos'),
    ]);
    publicar(os);
    setUsuarios(us);
    setModelos(ms);
  }, [publicar]);

  useEffect(() => {
    recarregar().catch((e) => setErroCarga(mensagemErro(e)));
  }, [recarregar]);

  // Avisa antes de fechar a aba com alteração ainda não enviada.
  useEffect(() => {
    if (!pendentes) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [pendentes]);

  /** Troca um gasto da obra pela versão do servidor (id igual). */
  const trocarGasto = useCallback((obraId: string, id: string, g: Gasto) => {
    const obra = obrasRef.current.find((o) => o.id === obraId);
    if (obra) trocarObra({ ...obra, gastos: (obra.gastos ?? []).map((x) => (x.id === id ? g : x)) });
  }, [trocarObra]);

  /** Recarrega só os gastos da obra (depois de importar ou desfazer um lote). */
  const recarregarGastos = useCallback(async (obraId: string) => {
    const gastos = await api<Gasto[]>('GET', `/obras/${obraId}/gastos`);
    const obra = obrasRef.current.find((o) => o.id === obraId);
    if (obra) trocarObra({ ...obra, gastos });
  }, [trocarObra]);

  // -------------------------------------------------------------------------
  // Fila por obra
  // -------------------------------------------------------------------------
  const processar = useCallback(async (obraId: string) => {
    if (rodando.current.has(obraId)) return;
    rodando.current.add(obraId);
    try {
      // Deixa terminar o clique atual (ex.: criarObra + atualizarObra no mesmo handler) antes de enviar.
      await new Promise((r) => setTimeout(r, 0));
      const fila = filas.current.get(obraId) ?? [];
      while (fila.length) {
        const op = fila.shift()!;
        // Junta "gravar" seguidos (e "gravar" logo depois de "criar"): o envio leva a versão mais recente.
        // Justificativas de gravações juntadas não se perdem: vão juntas no envio.
        let justificativas: string[] = op.tipo === 'gravar' && op.justificativa ? [op.justificativa] : [];
        if (op.tipo === 'criar' || op.tipo === 'gravar') {
          let juntadas = 0;
          while (fila[0]?.tipo === 'gravar') {
            const j = (fila.shift() as { justificativa?: string }).justificativa;
            if (j) justificativas = [...justificativas, j];
            juntadas++;
          }
          if (juntadas) setPendentes((n) => Math.max(0, n - juntadas));
        }
        const local = obrasRef.current.find((o) => o.id === obraId);
        try {
          let resposta: Obra | null = null;
          if (op.tipo === 'criar') {
            if (!local) continue;
            resposta = await api<Obra>('POST', '/obras', local);
          } else if (op.tipo === 'gravar') {
            if (!local) continue;
            const { alteracoes: _alts, ...corpo } = local;
            resposta = await api<Obra>('PUT', `/obras/${obraId}`, justificativas.length ? { ...corpo, justificativaAlteracao: justificativas.join(' | ') } : corpo);
          } else if (op.tipo === 'baseline') {
            resposta = await api<Obra>('POST', `/obras/${obraId}/baselines`, { justificativa: op.justificativa });
          } else if (op.tipo === 'apontamento') {
            const { tipo: _t, ...corpo } = op;
            resposta = await api<Obra>('POST', `/obras/${obraId}/apontamentos`, corpo);
          } else if (op.tipo === 'gasto_novo') {
            const { autorId: _a, criadoEm: _c, ...corpo } = op.gasto;
            trocarGasto(obraId, op.gasto.id, await api<Gasto>('POST', `/obras/${obraId}/gastos`, corpo));
          } else if (op.tipo === 'gasto_editar') {
            trocarGasto(obraId, op.id, await api<Gasto>('PATCH', `/gastos/${op.id}`, op.parcial));
          } else if (op.tipo === 'gasto_excluir') {
            await api('DELETE', `/gastos/${op.id}`);
          } else if (op.tipo === 'gasto_importar') {
            const r = await api<ResultadoImportacao>('POST', `/obras/${obraId}/gastos/importar`, { linhas: op.linhas });
            await recarregarGastos(obraId);
            op.ok(r);
          } else {
            await api('DELETE', `/importacoes/${op.importacaoId}`);
            await recarregarGastos(obraId);
            op.ok();
          }
          // Sem mais nada na fila: a versão do servidor vira a verdade. Com fila: só atualiza a revisão.
          const atual = obrasRef.current.find((o) => o.id === obraId);
          if (resposta) trocarObra(fila.length || !atual ? { ...(atual ?? resposta), revisao: resposta.revisao } : resposta);
        } catch (e) {
          const descartadas = fila.length;
          // Quem esperava promessa (importar/desfazer) recebe o erro; o resto da fila é descartado.
          for (const d of fila) if (comRetorno(d)) d.falha(new Error('Cancelado: uma alteração anterior desta obra não foi salva.'));
          fila.length = 0;
          if (descartadas) setPendentes((n) => Math.max(0, n - descartadas));
          if (comRetorno(op)) op.falha(e);
          else toast.error('Alteração não salva no servidor.', { description: mensagemErro(e) });
          try {
            const doServidor = await api<Obra>('GET', `/obras/${obraId}`);
            trocarObra(doServidor);
          } catch (e2) {
            if (e2 instanceof ErroApi && e2.status === 404) publicar(obrasRef.current.filter((o) => o.id !== obraId));
          }
        } finally {
          setPendentes((n) => Math.max(0, n - 1));
        }
      }
    } finally {
      rodando.current.delete(obraId);
      if ((filas.current.get(obraId) ?? []).length) void processar(obraId);
    }
  }, [publicar, trocarObra, trocarGasto, recarregarGastos]);

  const enfileirar = useCallback((obraId: string, op: Operacao) => {
    const fila = filas.current.get(obraId) ?? [];
    fila.push(op);
    filas.current.set(obraId, fila);
    setPendentes((n) => n + 1);
    void processar(obraId);
  }, [processar]);

  // -------------------------------------------------------------------------
  // Métodos do contrato
  // -------------------------------------------------------------------------
  const setHoje = useCallback((d: ISODate) => { if (/^\d{4}-\d{2}-\d{2}$/.test(d)) setHojeEstado(d); }, []);

  const criarObra = useCallback((p: ParametrosNovaObra): Obra => {
    const obra = gerarObra(p, novoId('obra'), modelos[p.tipo] ?? MODELOS[p.tipo]);
    trocarObra(obra);
    enfileirar(obra.id, { tipo: 'criar' });
    return obra;
  }, [modelos, trocarObra, enfileirar]);

  const atualizarObra = useCallback((obra: Obra, opcoes?: { justificativa?: string }) => {
    const atual = obrasRef.current.find((o) => o.id === obra.id);
    trocarObra({ ...obra, revisao: atual?.revisao ?? obra.revisao });
    enfileirar(obra.id, { tipo: 'gravar', justificativa: opcoes?.justificativa?.trim() || undefined });
  }, [trocarObra, enfileirar]);

  const congelarBaseline = useCallback((obraId: string, justificativa?: string) => {
    const obra = obrasRef.current.find((o) => o.id === obraId);
    if (!obra) return;
    if (obra.baselines.length >= 1 && !justificativa?.trim()) {
      throw new Error('Justificativa obrigatória para replanejar (baseline v2 ou posterior).');
    }
    trocarObra(congelarBaselineObra(obra, usuario.id, hojeLocal(), justificativa?.trim() || undefined));
    enfileirar(obraId, { tipo: 'baseline', justificativa: justificativa?.trim() || undefined });
  }, [usuario.id, trocarObra, enfileirar]);

  const lancarApontamento = useCallback<ObrasStore['lancarApontamento']>((a) => {
    const obra = obrasRef.current.find((o) => o.id === a.obraId);
    if (!obra) return;
    const r = aplicarApontamento(obra, a, usuario.id, hojeLocal(), novoId('ap-local'));
    if (!r) return;
    trocarObra(r.obra);
    enfileirar(a.obraId, { tipo: 'apontamento', itemId: a.itemId, percentualNovo: a.percentualNovo, observacao: a.observacao, fotos: a.fotos });
  }, [usuario.id, trocarObra, enfileirar]);

  const restaurarExemplos = useCallback(() => {
    const t = toast.loading('Recriando obras de exemplo...');
    api('POST', '/exemplos')
      .then(() => recarregar())
      .then(() => toast.success('Obras de exemplo recriadas.', { id: t }))
      .catch((e) => toast.error('Não foi possível recriar os exemplos.', { id: t, description: mensagemErro(e) }));
  }, [recarregar]);

  const excluirObra = useCallback(async (obraId: string) => {
    await api('DELETE', `/obras/${obraId}`);
    publicar(obrasRef.current.filter((o) => o.id !== obraId));
  }, [publicar]);

  // Gastos: otimistas na tela + fila por obra (mesma ordem dos outros envios da obra).
  const lancarGasto = useCallback((g: NovoGasto): Gasto => {
    const novo: Gasto = { ...g, valor: Math.round(g.valor * 100) / 100, id: novoId('gasto'), autorId: usuario.id, criadoEm: new Date().toISOString() };
    const obra = obrasRef.current.find((o) => o.id === g.obraId);
    if (!obra) return novo;
    trocarObra({ ...obra, gastos: [...(obra.gastos ?? []), novo] });
    enfileirar(obra.id, { tipo: 'gasto_novo', gasto: novo });
    return novo;
  }, [usuario.id, trocarObra, enfileirar]);

  const editarGasto = useCallback((id: string, parcial: EdicaoGasto) => {
    const obra = obrasRef.current.find((o) => (o.gastos ?? []).some((x) => x.id === id));
    if (!obra) return;
    const atual = obra.gastos.find((x) => x.id === id)!;
    const novo = { ...atual, ...parcial } as Gasto;
    // Campo opcional que veio vazio/undefined de propósito = apagar (no servidor vai como null).
    const corpo: Record<string, unknown> = { ...parcial };
    for (const k of ['atividadeId', 'fornecedor', 'documento'] as const) {
      if (k in parcial && !parcial[k]) { delete novo[k]; corpo[k] = null; }
    }
    // Trocou de etapa sem dizer a atividade: a atividade antiga é descartada (igual ao servidor).
    if (parcial.etapaCodigo !== undefined && parcial.etapaCodigo !== atual.etapaCodigo && !('atividadeId' in parcial)) delete novo.atividadeId;
    trocarObra({ ...obra, gastos: obra.gastos.map((x) => (x.id === id ? novo : x)) });
    enfileirar(obra.id, { tipo: 'gasto_editar', id, parcial: corpo });
  }, [trocarObra, enfileirar]);

  const excluirGasto = useCallback((id: string) => {
    const obra = obrasRef.current.find((o) => (o.gastos ?? []).some((x) => x.id === id));
    if (!obra) return;
    trocarObra({ ...obra, gastos: obra.gastos.filter((x) => x.id !== id) });
    enfileirar(obra.id, { tipo: 'gasto_excluir', id });
  }, [trocarObra, enfileirar]);

  const importarGastos = useCallback((obraId: string, linhas: Record<string, string>[]) =>
    new Promise<ResultadoImportacao>((ok, falha) => enfileirar(obraId, { tipo: 'gasto_importar', linhas, ok, falha })), [enfileirar]);

  const desfazerImportacao = useCallback((obraId: string, importacaoId: string) =>
    new Promise<void>((ok, falha) => enfileirar(obraId, { tipo: 'gasto_desfazer', importacaoId, ok, falha })), [enfileirar]);

  const atualizarModelo = useCallback((m: ModeloObra) => {
    setModelos((ms) => ({ ...ms, [m.tipo]: m }));
    api<ModeloObra>('PUT', `/modelos/${m.tipo}`, m)
      .then((salvo) => setModelos((ms) => ({ ...ms, [salvo.tipo]: salvo })))
      .catch((e) => {
        toast.error('Modelo não salvo no servidor.', { description: mensagemErro(e) });
        api<Record<TipoObra, ModeloObra>>('GET', '/modelos').then(setModelos).catch(() => {});
      });
  }, []);

  const restaurarModelos = useCallback(() => {
    setModelos(copiaModelos());
    api<Record<TipoObra, ModeloObra>>('DELETE', '/modelos')
      .then(setModelos)
      .catch((e) => toast.error('Não foi possível restaurar os modelos.', { description: mensagemErro(e) }));
  }, []);

  const restaurarModelo = useCallback((tipo: TipoObra) => {
    setModelos((ms) => ({ ...ms, [tipo]: copiaModelos()[tipo] }));
    api<ModeloObra>('DELETE', `/modelos/${tipo}`)
      .then((padrao) => setModelos((ms) => ({ ...ms, [tipo]: padrao })))
      .catch((e) => {
        toast.error('Não foi possível restaurar o modelo.', { description: mensagemErro(e) });
        api<Record<TipoObra, ModeloObra>>('GET', '/modelos').then(setModelos).catch(() => {});
      });
  }, []);

  const sair = useCallback(async () => {
    if (pendentes && !window.navigator.onLine) toast.warning('Há alterações não enviadas.');
    try { await api('POST', '/auth/logout'); } catch { /* sessão já pode ter expirado */ }
    aoSair();
  }, [aoSair, pendentes]);

  const value = useMemo<ObrasStore>(() => ({
    obras: obras ?? [],
    usuarios,
    usuarioAtual: usuario,
    setUsuarioAtual: () => {},
    hoje,
    setHoje,
    criarObra,
    atualizarObra,
    congelarBaseline,
    lancarApontamento,
    restaurarExemplos,
    modelos,
    atualizarModelo,
    restaurarModelos,
    restaurarModelo,
    sincronizando: pendentes > 0,
    sair,
    recarregar,
    recarregarUsuarios,
    excluirObra,
    lancarGasto,
    editarGasto,
    excluirGasto,
    importarGastos,
    desfazerImportacao,
  }), [lancarGasto, editarGasto, excluirGasto, importarGastos, desfazerImportacao, obras, usuarios, usuario, hoje, setHoje, criarObra, atualizarObra, congelarBaseline, lancarApontamento,
    restaurarExemplos, modelos, atualizarModelo, restaurarModelos, restaurarModelo, pendentes, sair, recarregar, recarregarUsuarios, excluirObra]);

  if (erroCarga) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gray-50 p-6 text-center">
        <p className="text-sm text-gray-900">Não foi possível carregar os dados.</p>
        <p className="text-xs text-muted">{erroCarga}</p>
        <button className="min-h-11 rounded-md border border-border bg-white px-4 text-sm" onClick={() => window.location.reload()}>Tentar de novo</button>
      </div>
    );
  }
  if (obras === null) return <TelaCarregando texto="Carregando obras..." />;
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

/** Obras visíveis ao usuário atual. A API já filtra; o filtro aqui só protege a tela. */
export function useObrasVisiveis(): Obra[] {
  const { obras, usuarioAtual } = useObras();
  if (usuarioAtual.perfil === 'diretor') return obras;
  const campo: keyof Obra = usuarioAtual.perfil === 'engenheiro' ? 'engenheiroId' : 'encarregadoId';
  return obras.filter((o) => o[campo] === usuarioAtual.id);
}

/** Quem vê R$. Regra do encarregado DESLIGADA (OCULTAR_VALORES_ENCARREGADO = false, decisão do Otavio 10/11). */
export function podeVerValores(perfil: Perfil): boolean {
  return !OCULTAR_VALORES_ENCARREGADO || perfil !== 'encarregado';
}
