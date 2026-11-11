import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Download, FileSpreadsheet, Upload } from 'lucide-react';
import { CATEGORIAS_GASTO, COLUNAS_PLANILHA_GASTO, validarLinhasGasto, type LinhaImportacao, type Obra, type ResultadoImportacao } from '@obras/shared';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { Aviso, Botao, Selo, cn } from '@/components/campo/ui';
import { formatarBRL, formatarData, plural } from '@/components/campo/formatos';
import { useObras } from '@/store';
import { hojeLocal } from '@/lib/api';
import { baixarTexto, lerArquivoPlanilha, montarCsvModelo, type ArquivoLido } from './planilha';
import { indiceObra, somarGastos } from './filtro';

/** Colunas sem as quais nenhuma linha passa: avisamos antes da prévia, com o nome certo. */
const OBRIGATORIAS = ['data', 'etapa', 'categoria', 'valor', 'descricao'];

type Passo = 'escolher' | 'previa' | 'enviando' | 'resumo';
interface LinhaPrevia extends LinhaImportacao {
  bruto: Record<string, string>;
  duplicada: boolean;
}

const chaveDup = (data: string, valor: number, descricao: string) => `${data}|${Math.round(valor * 100)}|${descricao.trim().toLocaleLowerCase('pt-BR')}`;

/** CSV modelo com cabeçalho + 2 linhas de exemplo tiradas da própria obra (etapa e atividade que existem nela). */
export function baixarModelo(obra: Obra) {
  const e1 = obra.etapas[0];
  const e2 = obra.etapas.find((e) => e.atividades.length > 0 && e !== e1) ?? e1;
  const a2 = e2?.atividades[0];
  const hojeBR = hojeLocal().split('-').reverse().join('/');
  const exemplos = [
    [hojeBR, String(e1?.codigo ?? 1), '', CATEGORIAS_GASTO.material, '1.234,56', 'EXEMPLO: 50 sacos de cimento (apague esta linha)', 'Fornecedor Exemplo', 'NF 123'],
    [hojeBR, e2?.nome ?? '', a2?.codigo ?? '', CATEGORIAS_GASTO.mao_de_obra, '850,00', 'EXEMPLO: diária de pedreiro (apague esta linha)', '', ''],
  ];
  baixarTexto('modelo-gastos.csv', montarCsvModelo(COLUNAS_PLANILHA_GASTO, exemplos));
}

export default function ImportarPlanilha({ obra, aberto, aoMudar }: { obra: Obra; aberto: boolean; aoMudar: (v: boolean) => void }) {
  const { importarGastos, desfazerImportacao } = useObras();
  const [passo, setPasso] = useState<Passo>('escolher');
  const [arquivo, setArquivo] = useState<{ nome: string; lido: ArquivoLido } | null>(null);
  const [erroArquivo, setErroArquivo] = useState<string | null>(null);
  const [lendo, setLendo] = useState(false);
  const [soErros, setSoErros] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const [desfazendo, setDesfazendo] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!aberto) return;
    setPasso('escolher');
    setArquivo(null);
    setErroArquivo(null);
    setResultado(null);
    setSoErros(false);
  }, [aberto]);

  const { etapas, atividades } = useMemo(() => indiceObra(obra), [obra]);

  const faltando = useMemo(() => (arquivo ? OBRIGATORIAS.filter((c) => !arquivo.lido.colunas.includes(c)) : []), [arquivo]);
  const ignoradas = useMemo(() => (arquivo ? arquivo.lido.colunas.filter((c) => c && !COLUNAS_PLANILHA_GASTO.includes(c)) : []), [arquivo]);

  const previa = useMemo<LinhaPrevia[]>(() => {
    if (!arquivo || faltando.length) return [];
    const brutas = arquivo.lido.linhas.map((l) => l.dados);
    let validadas: LinhaImportacao[];
    try {
      validadas = validarLinhasGasto(obra, brutas);
    } catch (e) {
      validadas = brutas.map(() => ({ linha: 0, erros: [e instanceof Error ? e.message : 'Erro ao validar.'] }));
    }
    const existentes = new Set(obra.gastos.map((g) => chaveDup(g.data, g.valor, g.descricao)));
    const vistas = new Set<string>();
    return validadas.map((v, i) => {
      let duplicada = false;
      if (v.dados) {
        const k = chaveDup(v.dados.data, v.dados.valor, v.dados.descricao);
        duplicada = existentes.has(k) || vistas.has(k);
        vistas.add(k);
      }
      // Linha de exemplo do modelo esquecida na planilha: não grava gasto fictício como real.
      const erros = v.dados && /^exemplo\s*:/i.test(v.dados.descricao.trim()) ? [...v.erros, 'Linha de exemplo do modelo: apague ou troque pela descrição do gasto real.'] : v.erros;
      // O número que o usuário vê na planilha (pulamos linhas em branco ao ler).
      return { ...v, erros, linha: arquivo.lido.linhas[i].numero, bruto: brutas[i], duplicada };
    });
  }, [arquivo, faltando, obra]);

  const validas = previa.filter((l) => l.dados && l.erros.length === 0);
  const comErro = previa.filter((l) => !l.dados || l.erros.length > 0);
  const duplicadas = validas.filter((l) => l.duplicada).length;
  const totalValidas = validas.reduce((s, l) => s + Math.round((l.dados?.valor ?? 0) * 100), 0) / 100;
  const visiveis = soErros ? comErro : previa;

  const escolher = async (file: File | undefined) => {
    if (!file) return;
    setLendo(true);
    setErroArquivo(null);
    try {
      const lido = await lerArquivoPlanilha(file);
      setArquivo({ nome: file.name, lido });
      setPasso('previa');
      setSoErros(false);
    } catch (e) {
      setErroArquivo(e instanceof Error ? e.message : 'Não foi possível ler o arquivo.');
    } finally {
      setLendo(false);
      if (input.current) input.current.value = '';
    }
  };

  const confirmar = async () => {
    if (!validas.length) return;
    setPasso('enviando');
    try {
      // Só as válidas; o servidor revalida com a mesma regra e grava tudo numa transação.
      const r = await importarGastos(obra.id, validas.map((l) => l.bruto));
      // Erros do servidor vêm numerados pelo que enviamos: traduz para a linha da planilha.
      const erros = r.erros.map((e) => ({ ...e, linha: validas[e.linha - 2]?.linha ?? e.linha }));
      setResultado({ ...r, erros });
      setPasso('resumo');
      if (r.gravadas > 0) toast.success(`${plural(r.gravadas, 'gasto importado', 'gastos importados')}.`);
    } catch (e) {
      toast.error('Importação não gravada.', { description: e instanceof Error ? e.message : String(e) });
      setPasso('previa');
    }
  };

  const desfazer = async () => {
    if (!resultado?.importacaoId) return;
    setDesfazendo(true);
    try {
      await desfazerImportacao(obra.id, resultado.importacaoId);
      toast.success('Importação desfeita.');
      aoMudar(false);
    } catch (e) {
      toast.error('Não foi possível desfazer.', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setDesfazendo(false);
    }
  };

  const nomeAtividade = (id?: string) => {
    if (!id) return 'Geral da etapa';
    const a = atividades.get(id);
    return a ? `${a.codigo} ${a.nome}` : id;
  };

  return (
    <Dialog.Root open={aberto} onOpenChange={(v) => passo !== 'enviando' && aoMudar(v)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-50 flex flex-col bg-surface outline-none sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[90dvh] sm:w-[calc(100%-2rem)] sm:max-w-4xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:shadow-2xl"
        >
          <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
            <div className="min-w-0">
              <Dialog.Title className="text-base font-semibold text-gray-900">Importar gastos de planilha</Dialog.Title>
              <div className="truncate text-sm text-muted">{arquivo && passo !== 'escolher' ? arquivo.nome : obra.nome}</div>
            </div>
            <Dialog.Close className="-mr-1 flex size-11 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-gray-100" aria-label="Fechar" disabled={passo === 'enviando'}>
              <X className="size-5" />
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            {passo === 'escolher' && (
              <div className="space-y-4">
                <p className="text-sm text-muted">
                  Use um arquivo <strong>.csv</strong> ou <strong>.xlsx</strong> com uma linha por gasto e o cabeçalho na primeira linha. Antes de gravar, você confere linha a linha o que
                  entra e o que tem erro.
                </p>
                <div className="rounded-lg border border-border bg-gray-50 p-3 text-sm">
                  <div className="font-medium text-gray-900">Colunas</div>
                  <ul className="mt-1 grid gap-x-4 gap-y-0.5 text-muted sm:grid-cols-2">
                    <li><strong className="text-gray-800">data</strong>: dd/mm/aaaa</li>
                    <li><strong className="text-gray-800">etapa</strong>: código (3) ou nome</li>
                    <li><strong className="text-gray-800">atividade</strong>: opcional, código ou nome</li>
                    <li><strong className="text-gray-800">categoria</strong>: {Object.values(CATEGORIAS_GASTO).join(', ')}</li>
                    <li><strong className="text-gray-800">valor</strong>: 1.234,56 ou 1234.56</li>
                    <li><strong className="text-gray-800">descricao</strong>: obrigatória</li>
                    <li><strong className="text-gray-800">fornecedor</strong> e <strong className="text-gray-800">documento</strong>: opcionais</li>
                  </ul>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Botao tamanho="lg" onClick={() => input.current?.click()} disabled={lendo}>
                    <Upload className="size-5" aria-hidden /> {lendo ? 'Lendo arquivo...' : 'Escolher arquivo'}
                  </Botao>
                  <Botao variante="secundario" tamanho="lg" onClick={() => baixarModelo(obra)}>
                    <Download className="size-5" aria-hidden /> Baixar modelo de planilha
                  </Botao>
                </div>
                <input
                  ref={input}
                  type="file"
                  accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="sr-only"
                  aria-label="Arquivo da planilha de gastos"
                  onChange={(e) => escolher(e.target.files?.[0])}
                />
                {erroArquivo && <Aviso tom="vermelho" titulo="Arquivo não lido">{erroArquivo}</Aviso>}
              </div>
            )}

            {(passo === 'previa' || passo === 'enviando') && arquivo && (
              <div className="space-y-3">
                {faltando.length > 0 ? (
                  <Aviso tom="vermelho" titulo={`Faltam colunas: ${faltando.join(', ')}`}>
                    Colunas encontradas: {arquivo.lido.colunas.filter(Boolean).join(', ') || 'nenhuma'}. Ajuste o cabeçalho (primeira linha) ou baixe o modelo.
                  </Aviso>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      <Resumo rotulo="Prontas para gravar" valor={String(validas.length)} detalhe={formatarBRL(totalValidas)} tom="verde" />
                      <Resumo rotulo="Com erro (não entram)" valor={String(comErro.length)} tom={comErro.length ? 'vermelho' : 'cinza'} />
                      <Resumo rotulo="Possíveis repetidas" valor={String(duplicadas)} detalhe="mesma data, valor e descrição" tom={duplicadas ? 'amarelo' : 'cinza'} className="col-span-2 sm:col-span-1" />
                    </div>
                    {ignoradas.length > 0 && <p className="text-xs text-muted">Colunas ignoradas: {ignoradas.join(', ')}.</p>}
                    {duplicadas > 0 && (
                      <Aviso titulo="Linhas que parecem já lançadas">
                        Já existe gasto nesta obra (ou na própria planilha) com a mesma data, valor e descrição. Elas vão ser gravadas mesmo assim: confira se não é a mesma planilha importada de novo.
                      </Aviso>
                    )}
                    {comErro.length > 0 && (
                      <label className="flex min-h-11 items-center gap-2 text-sm">
                        <input type="checkbox" className="size-4" checked={soErros} onChange={(e) => setSoErros(e.target.checked)} />
                        Mostrar só as linhas com erro
                      </label>
                    )}
                    <ul className="divide-y divide-border rounded-lg border border-border">
                      {visiveis.map((l) => {
                        const ok = !!l.dados && l.erros.length === 0;
                        return (
                          <li key={l.linha} className={cn('flex gap-3 px-3 py-2.5 text-sm', !ok && 'bg-red-50/60')}>
                            <span className="w-10 shrink-0 pt-0.5 text-xs tabular-nums text-muted">L{l.linha}</span>
                            <div className="min-w-0 flex-1">
                              {l.dados ? (
                                <>
                                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                                    <span className="font-medium text-gray-900">{l.dados.descricao}</span>
                                    <span className="font-semibold tabular-nums">{formatarBRL(l.dados.valor)}</span>
                                  </div>
                                  <div className="text-xs text-muted">
                                    {formatarData(l.dados.data)} · {l.dados.etapaCodigo}. {etapas.get(l.dados.etapaCodigo)} · {nomeAtividade(l.dados.atividadeId)} · {CATEGORIAS_GASTO[l.dados.categoria]}
                                    {l.dados.fornecedor ? ` · ${l.dados.fornecedor}` : ''}
                                    {l.dados.documento ? ` · ${l.dados.documento}` : ''}
                                  </div>
                                </>
                              ) : (
                                <div className="truncate text-xs text-gray-700">{Object.values(l.bruto).filter(Boolean).join(' · ') || '(linha vazia)'}</div>
                              )}
                              {l.erros.length > 0 && (
                                <ul className="mt-1 space-y-0.5 text-xs text-saude-vermelho">
                                  {l.erros.map((e) => (
                                    <li key={e}>{e}</li>
                                  ))}
                                </ul>
                              )}
                              {ok && l.duplicada && <Selo tom="amarelo" className="mt-1">possível repetida</Selo>}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </div>
            )}

            {passo === 'resumo' && resultado && (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-saude-verde" aria-hidden />
                  <div>
                    <div className="font-semibold text-gray-900">
                      {plural(resultado.gravadas, 'gasto gravado', 'gastos gravados')}
                    </div>
                    <div className="text-sm text-muted">
                      Total importado: {formatarBRL(somarGastos(obra.gastos.filter((g) => g.importacaoId && g.importacaoId === resultado.importacaoId)) || totalValidas)}. Os gastos já aparecem na lista e no Financeiro.
                    </div>
                  </div>
                </div>
                {resultado.erros.length > 0 && (
                  <Aviso tom="vermelho" titulo={`${plural(resultado.erros.length, 'linha recusada', 'linhas recusadas')} pelo servidor`}>
                    <ul className="mt-1 space-y-0.5">
                      {resultado.erros.map((e) => (
                        <li key={e.linha}>
                          Linha {e.linha}: {e.erros.join('; ')}
                        </li>
                      ))}
                    </ul>
                  </Aviso>
                )}
                {resultado.importacaoId && (
                  <p className="text-sm text-muted">Importou o arquivo errado? Dá para desfazer este lote inteiro agora ou depois, em "Importações" na aba Gastos.</p>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-border px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end">
            {passo === 'escolher' && (
              <Botao variante="secundario" onClick={() => aoMudar(false)}>
                Cancelar
              </Botao>
            )}
            {(passo === 'previa' || passo === 'enviando') && (
              <>
                <Botao variante="secundario" onClick={() => setPasso('escolher')} disabled={passo === 'enviando'}>
                  <FileSpreadsheet className="size-4" aria-hidden /> Escolher outro arquivo
                </Botao>
                <Botao onClick={confirmar} disabled={passo === 'enviando' || validas.length === 0}>
                  {passo === 'enviando'
                    ? 'Gravando...'
                    : validas.length === 0
                      ? 'Nenhuma linha válida'
                      : `Gravar ${plural(validas.length, 'gasto', 'gastos')} (${formatarBRL(totalValidas)})`}
                </Botao>
              </>
            )}
            {passo === 'resumo' && (
              <>
                {resultado?.importacaoId && (
                  <Botao variante="secundario" onClick={desfazer} disabled={desfazendo}>
                    {desfazendo ? 'Desfazendo...' : 'Desfazer importação'}
                  </Botao>
                )}
                <Botao onClick={() => aoMudar(false)}>Concluir</Botao>
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Resumo({ rotulo, valor, detalhe, tom, className }: { rotulo: string; valor: string; detalhe?: string; tom: 'verde' | 'vermelho' | 'amarelo' | 'cinza'; className?: string }) {
  const cor = { verde: 'text-saude-verde', vermelho: 'text-saude-vermelho', amarelo: 'text-saude-amarelo', cinza: 'text-gray-500' }[tom];
  return (
    <div className={cn('rounded-lg border border-border p-3', className)}>
      <div className="text-xs text-muted">{rotulo}</div>
      <div className={cn('text-xl font-semibold tabular-nums', cor)}>{valor}</div>
      {detalhe && <div className="text-xs text-muted">{detalhe}</div>}
    </div>
  );
}
