/**
 * Wizard "Nova obra" (Telas-Campo): Tipo → Parâmetros → Orçamento → Revisão.
 */
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Lock, Save } from 'lucide-react';
import { toast } from 'sonner';
import { congelarBaseline as congelarBaselineObra, gerarObra, type Obra, type TipoObra } from '@obras/shared';
import { useObras } from '@/store';
import { Aviso, Botao, Card, EstadoVazio, cn } from '@/components/campo/ui';
import ToasterCampo from '@/components/campo/ToasterCampo';
import PassoTipo from './nova-obra/PassoTipo';
import PassoParametros from './nova-obra/PassoParametros';
import PassoOrcamento from './nova-obra/PassoOrcamento';
import PassoRevisao from './nova-obra/PassoRevisao';
import { aplicarValoresEtapas, desdobramentoDe, formInicial, paramsDe, pavimentosPadrao, validarParametros, type FormNovaObra } from './nova-obra/estado';

const PASSOS = ['Tipo', 'Parâmetros', 'Orçamento', 'Revisão'] as const;

function Indicador({ atual, maximo, aoIr }: { atual: number; maximo: number; aoIr: (i: number) => void }) {
  return (
    <nav aria-label="Progresso do cadastro">
      <ol className="flex items-center gap-2">
        {PASSOS.map((p, i) => {
          const feito = i < atual;
          const ativo = i === atual;
          const alcancavel = i <= maximo;
          return (
            <li key={p} className="flex flex-1 items-center gap-2 last:flex-none">
              <button
                type="button"
                disabled={!alcancavel}
                onClick={() => aoIr(i)}
                aria-current={ativo ? 'step' : undefined}
                className="flex min-h-11 items-center gap-2 rounded-lg pr-1 text-left disabled:cursor-not-allowed"
              >
                <span
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold',
                    ativo && 'border-accent bg-accent text-white',
                    feito && 'border-saude-verde bg-saude-verde text-white',
                    !ativo && !feito && 'border-border bg-surface text-muted',
                  )}
                >
                  {feito ? <Check className="size-4" aria-hidden /> : i + 1}
                </span>
                <span className={cn('hidden text-sm sm:inline', ativo ? 'font-semibold text-gray-900' : 'text-muted')}>{p}</span>
              </button>
              {i < PASSOS.length - 1 && <span className={cn('h-px flex-1', feito ? 'bg-saude-verde' : 'bg-border')} aria-hidden />}
            </li>
          );
        })}
      </ol>
      <div className="mt-1 text-xs text-muted sm:hidden">
        Passo {atual + 1} de {PASSOS.length}: {PASSOS[atual]}
      </div>
    </nav>
  );
}

export default function NovaObraPage() {
  const store = useObras();
  const { usuarioAtual, usuarios, modelos, hoje } = store;
  const navigate = useNavigate();

  const [passo, setPasso] = useState(0);
  const [maximo, setMaximo] = useState(0);
  const [form, setForm] = useState<FormNovaObra>(() => formInicial(hoje, usuarioAtual.perfil === 'engenheiro' ? usuarioAtual.id : ''));
  const [mostrarErros, setMostrarErros] = useState(false);
  /** Valores (R$) editados por etapa no passo 3, válidos para a "chave" dos parâmetros em que foram feitos. */
  const [edicao, setEdicao] = useState<{ chave: string; valores: Record<number, number> }>({ chave: '', valores: {} });
  const [salvando, setSalvando] = useState(false);

  const modelo = form.tipo ? modelos[form.tipo] : undefined;
  const desd = desdobramentoDe(form.tipo, modelo);
  const erros = useMemo(() => validarParametros(form, desd), [form, desd]);
  const params = useMemo(() => (Object.keys(erros).length === 0 ? paramsDe(form, desd) : null), [form, desd, erros]);
  const chave = params ? JSON.stringify(params) : '';
  const valores = edicao.chave === chave ? edicao.valores : {};

  const previa = useMemo<{ obra: Obra | null; erro: string | null }>(() => {
    if (!params || !modelo) return { obra: null, erro: modelo ? null : 'O modelo deste tipo de obra ainda não foi carregado.' };
    try {
      return { obra: gerarObra(params, 'previa', modelo), erro: null };
    } catch (e) {
      return { obra: null, erro: e instanceof Error ? e.message : String(e) };
    }
  }, [params, modelo]);
  const ajustada = useMemo(() => (previa.obra ? aplicarValoresEtapas(previa.obra, valores) : null), [previa.obra, valores]);

  if (usuarioAtual.perfil === 'encarregado') {
    return (
      <div className="mx-auto max-w-xl py-8">
        <EstadoVazio icone={<Lock className="size-8" />} titulo="Cadastro de obras restrito" acao={<Link to="/campo" className="text-sm font-medium text-accent underline">Ir para o Campo</Link>}>
          O perfil encarregado não cadastra obras. Peça ao engenheiro ou ao diretor; você pode lançar o avanço das suas obras na tela Campo.
        </EstadoVazio>
      </div>
    );
  }

  const set = (p: Partial<FormNovaObra>) => setForm((f) => ({ ...f, ...p }));
  const escolherTipo = (t: TipoObra) => {
    if (t === form.tipo) return;
    setForm((f) => ({ ...f, tipo: t, pavimentos: pavimentosPadrao(t) }));
    setMaximo(0);
  };

  const soma = ajustada ? Math.round(ajustada.etapas.reduce((s, e) => s + e.valorOrcado, 0) * 100) / 100 : 0;
  const somaConfere = !!ajustada && Math.abs(soma - ajustada.orcamentoTotal) < 0.01;

  const passoValido = (i: number) => {
    if (i === 0) return !!form.tipo;
    if (i === 1) return Object.keys(erros).length === 0;
    if (i === 2) return somaConfere;
    return true;
  };

  const avancar = () => {
    if (!passoValido(passo)) {
      setMostrarErros(true);
      return;
    }
    setMostrarErros(false);
    const prox = passo + 1;
    setPasso(prox);
    setMaximo((m) => Math.max(m, prox));
    window.scrollTo({ top: 0 });
  };
  const irPara = (i: number) => {
    // Só deixa pular para frente se todos os passos anteriores estiverem válidos.
    for (let k = 0; k < i; k++) if (!passoValido(k)) return;
    setPasso(i);
  };

  const salvar = (congelar: boolean) => {
    if (!params || !ajustada) return;
    setSalvando(true);
    try {
      const criada = store.criarObra(params);
      let final = aplicarValoresEtapas(criada, valores);
      if (congelar) final = congelarBaselineObra(final, usuarioAtual.id, hoje);
      if (final !== criada) store.atualizarObra(final);
      toast.success(congelar ? 'Obra criada com baseline v1 congelada.' : 'Obra salva como planejamento.');
      navigate(`/obras/${criada.id}`);
    } catch (e) {
      setSalvando(false);
      toast.error('Não foi possível salvar a obra.', { description: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-28">
      <ToasterCampo />
      <div>
        <Link to="/obras" className="inline-flex min-h-11 items-center gap-1 text-sm text-muted hover:text-gray-900">
          <ArrowLeft className="size-4" aria-hidden /> Obras
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">Nova obra</h1>
      </div>

      <Indicador atual={passo} maximo={maximo} aoIr={irPara} />

      <Card className="p-4 sm:p-6">
        {passo === 0 && <PassoTipo modelos={modelos} valor={form.tipo} aoEscolher={escolherTipo} erro={mostrarErros && !form.tipo ? 'Escolha um tipo para continuar.' : undefined} />}
        {passo === 1 && <PassoParametros form={form} set={set} desdobramento={desd} usuarios={usuarios} erros={erros} mostrarErros={mostrarErros} />}
        {passo === 2 && (
          <PassoOrcamento
            obra={ajustada}
            erroPrevia={previa.erro}
            temEdicao={Object.keys(valores).length > 0}
            aoMudarValor={(codigo, v) => setEdicao({ chave, valores: { ...valores, [codigo]: v } })}
            aoRestaurar={() => setEdicao({ chave, valores: {} })}
          />
        )}
        {passo === 3 && ajustada && <PassoRevisao obra={ajustada} usuarios={usuarios} />}
        {passo === 3 && !ajustada && <Aviso tom="vermelho" titulo="Prévia indisponível">Volte ao passo de orçamento.</Aviso>}
      </Card>

      {mostrarErros && passo === 1 && Object.keys(erros).length > 0 && (
        <Aviso tom="vermelho" titulo="Corrija os campos destacados para continuar." />
      )}

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-between gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
        <Botao variante="secundario" onClick={() => setPasso((p) => Math.max(0, p - 1))} disabled={passo === 0 || salvando}>
          <ArrowLeft className="size-4" aria-hidden /> Voltar
        </Botao>
        {passo < 3 ? (
          <Botao onClick={avancar} disabled={passo === 2 && !somaConfere}>
            Continuar <ArrowRight className="size-4" aria-hidden />
          </Botao>
        ) : (
          <div className="flex flex-wrap justify-end gap-2">
            <Botao variante="secundario" onClick={() => salvar(false)} disabled={salvando || !ajustada}>
              <Save className="size-4" aria-hidden /> Salvar como planejamento
            </Botao>
            <Botao onClick={() => salvar(true)} disabled={salvando || !ajustada}>
              <Lock className="size-4" aria-hidden /> Salvar e congelar baseline v1
            </Botao>
          </div>
        )}
      </div>
    </div>
  );
}
