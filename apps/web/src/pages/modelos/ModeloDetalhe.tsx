import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Eye, Pencil, RotateCcw, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { ETAPAS_CAIXA, MODELOS, NOMES_TIPO, type ModeloAtividade, type ModeloObra, type TipoObra } from '@obras/shared';
import { useObras } from '@/store';
import { Aviso, Botao, Card, DialogoConfirmar, EstadoVazio, Selo, SeloEstimativa, SeloNaoConfirmado, cn } from '@/components/campo/ui';
import EntradaNumero from '@/components/campo/EntradaNumero';
import Fonte from '@/components/campo/Fonte';
import { NOMES_PAVIMENTO, formatarPct } from '@/components/campo/formatos';
import { etapasComPesoInvalido, modeloFoiEditado, normalizarEtapa, somaPesosPorEtapa } from './regras';

const DESDOBRAMENTO: Record<ModeloObra['desdobramento'], string> = {
  nenhum: 'Obra toda (sem divisão por local)',
  pavimentos: 'Por pavimento',
  unidades: 'Por unidade (casa)',
};

const nomeEtapa = (codigo: number) => ETAPAS_CAIXA.find((e) => e.codigo === codigo)?.nome ?? `Etapa ${codigo}`;

function CabecalhoTabela({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn('px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted', className)}>{children}</th>;
}

export default function ModeloDetalhe({ tipo }: { tipo: TipoObra }) {
  const { modelos, usuarioAtual, atualizarModelo, restaurarModelo } = useObras();
  const podeEditar = usuarioAtual.perfil === 'diretor' || usuarioAtual.perfil === 'engenheiro';
  const salvo = modelos[tipo] as ModeloObra | undefined;
  const padrao = MODELOS[tipo] as ModeloObra | undefined;
  const [rascunho, setRascunho] = useState<ModeloObra | null>(null);
  const [confirmarRestaurar, setConfirmarRestaurar] = useState(false);

  const m = rascunho ?? salvo;
  const somas = useMemo(() => (m ? somaPesosPorEtapa(m) : new Map<number, number>()), [m]);
  const invalidas = useMemo(() => (m ? etapasComPesoInvalido(m) : []), [m]);

  if (!m) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <Voltar />
        <EstadoVazio titulo={`Modelo "${NOMES_TIPO[tipo] ?? tipo}" ainda não carregado`}>Os modelos aparecem aqui assim que o motor estiver no ar.</EstadoVazio>
      </div>
    );
  }

  const editando = rascunho !== null;
  const sujo = editando && salvo ? modeloFoiEditado(rascunho, salvo) : false;
  const editadoVsPadrao = salvo && padrao ? modeloFoiEditado(salvo, padrao) : false;
  const naoConf = m.atividades.filter((a) => !a.duracaoConfirmada).length;
  const somaDistrib = m.etapasAtivas.reduce((s, c) => s + (m.distribuicaoPadrao[c] ?? 0), 0);

  const alterarAtividade = (codigo: string, p: Partial<ModeloAtividade>) =>
    setRascunho((r) => (r ? { ...r, atividades: r.atividades.map((a) => (a.codigo === codigo ? { ...a, ...p } : a)) } : r));

  const salvar = () => {
    if (!rascunho || invalidas.length) return;
    try {
      atualizarModelo(rascunho);
      setRascunho(null);
      toast.success('Modelo salvo.', { description: 'Vale para as próximas obras criadas a partir dele.' });
    } catch (e) {
      toast.error('Não foi possível salvar o modelo.', { description: e instanceof Error ? e.message : String(e) });
    }
  };
  const restaurar = () => {
    if (!padrao) return;
    try {
      restaurarModelo(padrao.tipo);
      setRascunho(null);
      toast.success('Modelo padrão restaurado.');
    } catch (e) {
      toast.error('Não foi possível restaurar o modelo.', { description: e instanceof Error ? e.message : String(e) });
    }
  };

  const atividadesPorEtapa = m.etapasAtivas.map((codigo) => ({ codigo, atividades: m.atividades.filter((a) => a.etapaCodigo === codigo) }));

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-24">
      <div className="space-y-2">
        <Voltar />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{m.nome}</h1>
            <p className="max-w-2xl text-sm text-muted">{m.descricao}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Selo>{DESDOBRAMENTO[m.desdobramento]}</Selo>
              <Selo>{m.etapasAtivas.length} etapas ativas</Selo>
              <Selo>{m.atividades.length} atividades</Selo>
              {naoConf > 0 && <Selo tom="amarelo">{naoConf === 1 ? '1 duração não confirmada' : `${naoConf} durações não confirmadas`}</Selo>}
              {editadoVsPadrao && <Selo tom="azul">editado em relação ao padrão</Selo>}
            </div>
          </div>
          {podeEditar ? (
            !editando && (
              <div className="flex flex-wrap gap-2">
                <Botao variante="secundario" onClick={() => setConfirmarRestaurar(true)} disabled={!padrao || !editadoVsPadrao}>
                  <RotateCcw className="size-4" aria-hidden /> Restaurar modelo padrão
                </Botao>
                <Botao onClick={() => setRascunho(structuredClone(salvo!))} disabled={!salvo}>
                  <Pencil className="size-4" aria-hidden /> Editar
                </Botao>
              </div>
            )
          ) : (
            <Selo>
              <Eye className="size-3" aria-hidden /> Somente leitura
            </Selo>
          )}
        </div>
      </div>

      {editando && invalidas.length > 0 && (
        <Aviso tom="vermelho" titulo={invalidas.length === 1 ? 'Os pesos de 1 etapa não somam 100%' : `Os pesos de ${invalidas.length} etapas não somam 100%`}>
          Ajuste os pesos ou use "Normalizar para 100%" na etapa. O modelo só pode ser salvo com todas as etapas somando 100%.
        </Aviso>
      )}

      <Card className="overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Etapas ativas e distribuição padrão do orçamento</h2>
          <p className="text-xs text-muted">O percentual padrão é a estimativa usada pela Nova obra: ponto médio da faixa Caixa, normalizado para somar 100%.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="bg-gray-50">
              <tr>
                <CabecalhoTabela>Etapa</CabecalhoTabela>
                <CabecalhoTabela className="text-right">% padrão</CabecalhoTabela>
                <CabecalhoTabela className="text-right">Faixa Caixa</CabecalhoTabela>
                <CabecalhoTabela>Situação</CabecalhoTabela>
                <CabecalhoTabela>Fonte</CabecalhoTabela>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {m.etapasAtivas.map((c) => {
                const ref = ETAPAS_CAIXA.find((e) => e.codigo === c);
                const v = m.distribuicaoPadrao[c] ?? 0;
                const temFaixa = ref && ref.faixaMin !== null && ref.faixaMax !== null;
                const dentro = temFaixa && v >= ref!.faixaMin! && v <= ref!.faixaMax!;
                return (
                  <tr key={c}>
                    <td className="px-3 py-2">
                      <span className="mr-1 text-xs text-muted">{c}.</span>
                      {nomeEtapa(c)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <span className="inline-flex items-center gap-2">
                        {formatarPct(v)} <SeloEstimativa />
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{temFaixa ? `${formatarPct(ref!.faixaMin!)} a ${formatarPct(ref!.faixaMax!)}` : 'sem referência'}</td>
                    <td className="px-3 py-2">{!temFaixa ? <span className="text-xs text-muted">sem faixa</span> : dentro ? <Selo tom="verde">dentro</Selo> : <Selo tom="amarelo">fora da faixa</Selo>}</td>
                    <td className="max-w-64 px-3 py-2 text-xs text-muted">
                      <Fonte fonte={ref?.fonte} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr>
                <td className="px-3 py-2 font-medium">Total</td>
                <td className={cn('px-3 py-2 text-right font-semibold tabular-nums', Math.abs(somaDistrib - 100) > 0.05 && 'text-saude-vermelho')}>{formatarPct(somaDistrib)}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">Atividades por etapa</h2>
          <p className="text-sm text-muted">
            Peso na etapa = participação da atividade no valor da etapa. Duração em dias úteis, por local quando a atividade se repete em cada pavimento ou unidade.
          </p>
        </div>
        {atividadesPorEtapa.map(({ codigo, atividades }) => {
          const soma = somas.get(codigo) ?? 0;
          const invalida = invalidas.includes(codigo);
          return (
            <Card key={codigo} className={cn('overflow-hidden', editando && invalida && 'border-saude-vermelho')}>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
                <h3 className="text-sm font-semibold">
                  <span className="mr-1 text-muted">{codigo}.</span>
                  {nomeEtapa(codigo)}
                </h3>
                <div className="flex items-center gap-2">
                  <span className={cn('text-xs tabular-nums', invalida ? 'font-semibold text-saude-vermelho' : 'text-muted')}>Soma dos pesos: {formatarPct(soma * 100)}</span>
                  {editando && invalida && (
                    <Botao variante="secundario" className="min-h-9 text-xs" onClick={() => setRascunho((r) => (r ? normalizarEtapa(r, codigo) : r))}>
                      Normalizar para 100%
                    </Botao>
                  )}
                </div>
              </div>
              {atividades.length === 0 ? (
                <p className="px-4 py-3 text-sm text-muted">Nenhuma atividade nesta etapa.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[60rem] text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <CabecalhoTabela>Código</CabecalhoTabela>
                        <CabecalhoTabela>Atividade</CabecalhoTabela>
                        <CabecalhoTabela className="text-right">Peso</CabecalhoTabela>
                        <CabecalhoTabela className="text-right">Duração</CabecalhoTabela>
                        <CabecalhoTabela>Local</CabecalhoTabela>
                        <CabecalhoTabela>Predecessoras</CabecalhoTabela>
                        <CabecalhoTabela>Duração confirmada</CabecalhoTabela>
                        <CabecalhoTabela>Fonte</CabecalhoTabela>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {atividades.map((a) => (
                        <tr key={a.codigo} className="align-middle">
                          <td className="px-3 py-2 tabular-nums text-muted">{a.codigo}</td>
                          <td className="px-3 py-2 font-medium text-gray-900">{a.nome}</td>
                          <td className="w-28 px-3 py-2 text-right tabular-nums">
                            {editando ? (
                              <EntradaNumero rotulo={`Peso de ${a.nome} na etapa`} valor={Math.round(a.pesoNaEtapa * 10000) / 100} casas={2} min={0} max={100} sufixo="%" aoConfirmar={(v) => alterarAtividade(a.codigo, { pesoNaEtapa: Math.round(v * 100) / 10000 })} />
                            ) : (
                              formatarPct(a.pesoNaEtapa * 100)
                            )}
                          </td>
                          <td className="w-28 px-3 py-2 text-right tabular-nums">
                            {editando ? (
                              <EntradaNumero rotulo={`Duração de ${a.nome} em dias úteis`} valor={a.duracaoDiasUteis} casas={0} min={1} max={999} sufixo="d" aoConfirmar={(v) => alterarAtividade(a.codigo, { duracaoDiasUteis: Math.round(v) })} />
                            ) : (
                              `${a.duracaoDiasUteis} d`
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {a.porLocal ? (
                              <>
                                <div>por local</div>
                                <div className="text-muted">{a.tiposPavimento?.length ? a.tiposPavimento.map((t) => NOMES_PAVIMENTO[t]).join(', ') : 'todos os pavimentos'}</div>
                              </>
                            ) : (
                              'obra toda'
                            )}
                            {a.minPavimentos !== undefined && <div className="text-muted">só com {a.minPavimentos}+ pavimentos</div>}
                          </td>
                          <td className="px-3 py-2 text-xs tabular-nums text-muted">{a.predecessoras.length ? a.predecessoras.join(', ') : 'nenhuma'}</td>
                          <td className="px-3 py-2">
                            {editando ? (
                              <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-xs">
                                <input type="checkbox" className="size-5 accent-accent" checked={a.duracaoConfirmada} onChange={(e) => alterarAtividade(a.codigo, { duracaoConfirmada: e.target.checked })} />
                                {a.duracaoConfirmada ? 'confirmada' : <SeloNaoConfirmado />}
                              </label>
                            ) : a.duracaoConfirmada ? (
                              <Selo tom="verde">confirmada</Selo>
                            ) : (
                              <SeloNaoConfirmado />
                            )}
                          </td>
                          <td className="max-w-64 px-3 py-2 text-xs text-muted">
                            <Fonte fonte={a.fonte} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {editando && (
        <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-between gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
          <span className="text-sm text-muted">{sujo ? 'Alterações não salvas.' : 'Nenhuma alteração ainda.'}</span>
          <div className="flex gap-2">
            <Botao variante="secundario" onClick={() => setRascunho(null)}>
              <X className="size-4" aria-hidden /> Descartar
            </Botao>
            <Botao onClick={salvar} disabled={!sujo || invalidas.length > 0}>
              <Save className="size-4" aria-hidden /> Salvar modelo
            </Botao>
          </div>
        </div>
      )}

      <DialogoConfirmar
        aberto={confirmarRestaurar}
        aoMudar={setConfirmarRestaurar}
        titulo="Restaurar modelo padrão?"
        descricao={`As edições de durações, pesos e confirmações do modelo "${m.nome}" serão descartadas. Obras já criadas não mudam.`}
        rotuloConfirmar="Restaurar"
        perigo
        aoConfirmar={restaurar}
      />
    </div>
  );
}

function Voltar() {
  return (
    <Link to="/modelos" className="inline-flex min-h-11 items-center gap-1 text-sm text-muted hover:text-gray-900">
      <ArrowLeft className="size-4" aria-hidden /> Modelos
    </Link>
  );
}
