import { useMemo, useState } from 'react';
import { FileUp, Filter, Pencil, Plus, Search, Trash2, Undo2, X } from 'lucide-react';
import { toast } from 'sonner';
import { CATEGORIAS_GASTO, type CategoriaGasto, type Gasto, type Obra } from '@obras/shared';
import { Aviso, Botao, Card, DialogoConfirmar, Entrada, EstadoVazio, Selecao, Selo, cn } from '@/components/campo/ui';
import { formatarBRL, formatarData, plural } from '@/components/campo/formatos';
import { useObras, podeVerValores } from '@/store';
import { hojeLocal } from '@/lib/api';
import { useNomeUsuario } from './comum';
import FormGasto from '../gastos/FormGasto';
import ImportarPlanilha from '../gastos/ImportarPlanilha';
import { ATIVIDADE_GERAL, FILTRO_VAZIO, filtrarGastos, filtroAtivo, indiceObra, lotesImportados, somarGastos, type FiltroGastos } from '../gastos/filtro';

const PAGINA = 50;

/** Aba Gastos: lançamento e conferência dos gastos reais da obra (todos os perfis, plano 2026-11-10). */
export default function AbaGastos({ obra }: { obra: Obra }) {
  const { usuarioAtual, excluirGasto, desfazerImportacao } = useObras();
  const nome = useNomeUsuario();
  const [f, setF] = useState<FiltroGastos>(FILTRO_VAZIO);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [limite, setLimite] = useState(PAGINA);
  const [form, setForm] = useState<{ aberto: boolean; gasto: Gasto | null }>({ aberto: false, gasto: null });
  const [importar, setImportar] = useState(false);
  const [excluir, setExcluir] = useState<Gasto | null>(null);
  const [desfazer, setDesfazer] = useState<string | null>(null);

  const gastos = obra.gastos ?? [];
  const idx = useMemo(() => indiceObra(obra), [obra]);
  const lista = useMemo(() => filtrarGastos(obra, gastos, f), [obra, gastos, f]);
  const total = useMemo(() => somarGastos(lista), [lista]);
  const totalGeral = useMemo(() => somarGastos(gastos), [gastos]);
  const lotes = useMemo(() => lotesImportados(gastos), [gastos]);
  const etapaFiltro = f.etapa !== null ? obra.etapas.find((e) => e.codigo === f.etapa) : undefined;
  const ativo = filtroAtivo(f);
  const set = (p: Partial<FiltroGastos>) => {
    setF((x) => ({ ...x, ...p }));
    setLimite(PAGINA);
  };

  if (!podeVerValores(usuarioAtual.perfil)) {
    return <EstadoVazio titulo="Gastos indisponíveis para o seu perfil">Peça ao engenheiro ou ao diretor para lançar ou conferir os gastos desta obra.</EstadoVazio>;
  }

  const rotuloAtividade = (g: Gasto) => {
    if (!g.atividadeId) return 'Geral da etapa';
    const a = idx.atividades.get(g.atividadeId);
    return a ? `${a.codigo} ${a.nome}` : 'Atividade removida';
  };
  const lote = lotes.find((l) => l.id === desfazer);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900">Gastos reais</h2>
            <p className="text-sm text-muted">
              {gastos.length === 0
                ? 'Nenhum gasto lançado ainda.'
                : `${plural(gastos.length, 'gasto lançado', 'gastos lançados')}, ${formatarBRL(totalGeral)} no total. O Financeiro compara com o valor do que já foi feito.`}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Botao variante="secundario" onClick={() => setImportar(true)}>
              <FileUp className="size-4" aria-hidden /> Importar planilha
            </Botao>
            <Botao onClick={() => setForm({ aberto: true, gasto: null })}>
              <Plus className="size-4" aria-hidden /> Novo gasto
            </Botao>
          </div>
        </div>

        {gastos.length > 0 && (
          <div className="mt-4 space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
                <Entrada
                  value={f.texto}
                  onChange={(e) => set({ texto: e.target.value })}
                  placeholder="Buscar descrição, fornecedor, nota..."
                  aria-label="Buscar gastos"
                  className="pl-9"
                />
              </div>
              <Botao
                variante="secundario"
                className="lg:hidden"
                aria-expanded={filtrosAbertos}
                aria-controls="filtros-gastos"
                onClick={() => setFiltrosAbertos((v) => !v)}
              >
                <Filter className="size-4" aria-hidden />
                <span className="sr-only sm:not-sr-only">Filtros</span>
              </Botao>
            </div>
            <div id="filtros-gastos" className={cn('grid gap-2 sm:grid-cols-2 lg:grid-cols-5', !filtrosAbertos && 'hidden lg:grid')}>
              <label className="space-y-1 text-xs text-muted">
                De
                <Entrada type="date" value={f.de} onChange={(e) => set({ de: e.target.value })} />
              </label>
              <label className="space-y-1 text-xs text-muted">
                Até
                <Entrada type="date" value={f.ate} onChange={(e) => set({ ate: e.target.value })} />
              </label>
              <label className="space-y-1 text-xs text-muted">
                Etapa
                <Selecao value={f.etapa ?? ''} onChange={(e) => set({ etapa: e.target.value ? Number(e.target.value) : null, atividade: '' })}>
                  <option value="">Todas as etapas</option>
                  {obra.etapas.map((e) => (
                    <option key={e.codigo} value={e.codigo}>
                      {e.codigo}. {e.nome}
                    </option>
                  ))}
                </Selecao>
              </label>
              <label className="space-y-1 text-xs text-muted">
                Atividade
                <Selecao value={f.atividade} onChange={(e) => set({ atividade: e.target.value })}>
                  <option value="">Todas as atividades</option>
                  <option value={ATIVIDADE_GERAL}>Geral da etapa (sem atividade)</option>
                  {(etapaFiltro ? [etapaFiltro] : obra.etapas).flatMap((e) =>
                    e.atividades.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.codigo} {a.nome}
                      </option>
                    )),
                  )}
                </Selecao>
              </label>
              <label className="space-y-1 text-xs text-muted">
                Categoria
                <Selecao value={f.categoria} onChange={(e) => set({ categoria: e.target.value as CategoriaGasto | '' })}>
                  <option value="">Todas as categorias</option>
                  {(Object.entries(CATEGORIAS_GASTO) as [CategoriaGasto, string][]).map(([k, r]) => (
                    <option key={k} value={k}>
                      {r}
                    </option>
                  ))}
                </Selecao>
              </label>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm" aria-live="polite">
              <span>
                {ativo ? (
                  <>
                    {plural(lista.length, 'gasto', 'gastos')} no filtro: <strong className="tabular-nums">{formatarBRL(total)}</strong>
                    <span className="text-muted"> de {formatarBRL(totalGeral)}</span>
                  </>
                ) : (
                  <>
                    Total: <strong className="tabular-nums">{formatarBRL(total)}</strong>
                  </>
                )}
              </span>
              {ativo && (
                <button type="button" className="inline-flex min-h-11 items-center gap-1 text-accent hover:underline" onClick={() => set(FILTRO_VAZIO)}>
                  <X className="size-4" aria-hidden /> Limpar filtros
                </button>
              )}
            </div>
          </div>
        )}
      </Card>

      {gastos.length === 0 ? (
        <EstadoVazio
          icone={<FileUp className="size-8" />}
          titulo="Lance o primeiro gasto"
          acao={
            <div className="flex flex-col gap-2 sm:flex-row">
              <Botao onClick={() => setForm({ aberto: true, gasto: null })}>
                <Plus className="size-4" aria-hidden /> Novo gasto
              </Botao>
              <Botao variante="secundario" onClick={() => setImportar(true)}>
                Importar planilha
              </Botao>
            </div>
          }
        >
          Cada gasto tem etapa e categoria; a atividade é opcional. Notas antigas podem vir de uma planilha CSV ou Excel.
        </EstadoVazio>
      ) : lista.length === 0 ? (
        <EstadoVazio titulo="Nenhum gasto neste filtro" acao={<Botao variante="secundario" onClick={() => set(FILTRO_VAZIO)}>Limpar filtros</Botao>} />
      ) : (
        <Card className="overflow-hidden">
          {/* Cabeçalho só no desktop; no celular cada gasto é um cartão. */}
          <div className="hidden grid-cols-[6rem_minmax(0,1.6fr)_minmax(0,1.4fr)_8rem_8rem_5.5rem] gap-3 border-b border-border bg-gray-50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted lg:grid">
            <span>Data</span>
            <span>Descrição</span>
            <span>Etapa / atividade</span>
            <span>Categoria</span>
            <span className="text-right">Valor</span>
            <span className="sr-only">Ações</span>
          </div>
          <ul className="divide-y divide-border">
            {lista.slice(0, limite).map((g) => (
              <li key={g.id} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 px-4 py-3 lg:grid-cols-[6rem_minmax(0,1.6fr)_minmax(0,1.4fr)_8rem_8rem_5.5rem] lg:items-center">
                <span className="order-2 text-xs tabular-nums text-muted lg:order-none lg:text-sm lg:text-gray-700">{formatarData(g.data)}</span>
                <div className="order-1 col-span-2 min-w-0 lg:order-none lg:col-span-1">
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-medium text-gray-900 [overflow-wrap:anywhere]">{g.descricao}</span>
                    <span className="shrink-0 font-semibold tabular-nums lg:hidden">{formatarBRL(g.valor)}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-2 text-xs text-muted">
                    {g.fornecedor && <span>{g.fornecedor}</span>}
                    {g.documento && <span>{g.documento}</span>}
                    <span className="hidden lg:inline">por {nome(g.autorId)}</span>
                    {g.importacaoId && <Selo tom="azul">planilha</Selo>}
                    {g.exemplo && <Selo tom="cinza">exemplo</Selo>}
                  </div>
                </div>
                <div className="order-3 col-span-2 min-w-0 text-xs text-muted lg:order-none lg:col-span-1 lg:text-sm lg:text-gray-700">
                  <div className="truncate">
                    {g.etapaCodigo}. {idx.etapas.get(g.etapaCodigo) ?? 'Etapa'}
                  </div>
                  <div className={cn('truncate', !g.atividadeId && 'italic')}>{rotuloAtividade(g)}</div>
                </div>
                <span className="order-4 text-xs text-muted lg:order-none lg:text-sm lg:text-gray-700">{CATEGORIAS_GASTO[g.categoria] ?? g.categoria}</span>
                <span className="hidden text-right font-semibold tabular-nums lg:block">{formatarBRL(g.valor)}</span>
                <div className="order-5 col-span-2 -mb-1 flex justify-end gap-1 lg:order-none lg:col-span-1">
                  <Botao variante="fantasma" tamanho="icone" aria-label={`Editar gasto ${g.descricao}`} onClick={() => setForm({ aberto: true, gasto: g })}>
                    <Pencil className="size-4" aria-hidden />
                  </Botao>
                  <Botao variante="fantasma" tamanho="icone" aria-label={`Excluir gasto ${g.descricao}`} onClick={() => setExcluir(g)}>
                    <Trash2 className="size-4 text-saude-vermelho" aria-hidden />
                  </Botao>
                </div>
              </li>
            ))}
          </ul>
          {lista.length > limite && (
            <div className="border-t border-border p-3 text-center">
              <Botao variante="secundario" onClick={() => setLimite((l) => l + PAGINA)}>
                Mostrar mais {Math.min(PAGINA, lista.length - limite)} de {lista.length - limite}
              </Botao>
            </div>
          )}
        </Card>
      )}

      {lotes.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-gray-900">Importações</h3>
          <p className="text-xs text-muted">Cada planilha importada vira um lote. Desfazer apaga todos os gastos daquele lote.</p>
          <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
            {lotes.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <div className="font-medium text-gray-900">
                    {plural(l.quantidade, 'gasto', 'gastos')} · <span className="tabular-nums">{formatarBRL(l.total)}</span>
                  </div>
                  <div className="text-xs text-muted">
                    Importado em {formatarData(l.em.slice(0, 10))} por {nome(l.autorId)} · gastos de {formatarData(l.de)}
                    {l.ate !== l.de ? ` a ${formatarData(l.ate)}` : ''}
                  </div>
                </div>
                <Botao variante="secundario" onClick={() => setDesfazer(l.id)}>
                  <Undo2 className="size-4" aria-hidden /> Desfazer importação
                </Botao>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {gastos.some((g) => g.data > hojeLocal()) && (
        <Aviso tom="azul" titulo="Há gastos com data futura">
          Eles aparecem na lista, mas só contam no "Gasto real" do Financeiro a partir da data de cada um.
        </Aviso>
      )}

      <FormGasto obra={obra} aberto={form.aberto} aoMudar={(v) => setForm((x) => ({ ...x, aberto: v }))} gasto={form.gasto} />
      <ImportarPlanilha obra={obra} aberto={importar} aoMudar={setImportar} />
      <DialogoConfirmar
        aberto={!!excluir}
        aoMudar={(v) => !v && setExcluir(null)}
        titulo="Excluir gasto?"
        descricao={
          excluir && (
            <>
              <strong className="text-gray-900">{excluir.descricao}</strong>, {formatarBRL(excluir.valor)} em {formatarData(excluir.data)}. O gasto some da lista e do
              Financeiro. Esta ação não pode ser desfeita.
            </>
          )
        }
        rotuloConfirmar="Excluir gasto"
        perigo
        aoConfirmar={() => {
          if (!excluir) return;
          excluirGasto(excluir.id);
          toast.success('Gasto excluído.');
        }}
      />
      <DialogoConfirmar
        aberto={!!desfazer}
        aoMudar={(v) => !v && setDesfazer(null)}
        titulo="Desfazer importação?"
        descricao={lote && <>Apaga os {plural(lote.quantidade, 'gasto', 'gastos')} deste lote ({formatarBRL(lote.total)}), inclusive os que foram editados depois. Esta ação não pode ser desfeita.</>}
        rotuloConfirmar="Desfazer importação"
        perigo
        aoConfirmar={() => {
          if (!desfazer) return;
          desfazerImportacao(obra.id, desfazer)
            .then(() => toast.success('Importação desfeita.'))
            .catch((e) => toast.error('Não foi possível desfazer a importação.', { description: e instanceof Error ? e.message : String(e) }));
        }}
      />
    </div>
  );
}
