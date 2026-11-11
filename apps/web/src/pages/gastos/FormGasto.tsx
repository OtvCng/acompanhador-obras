import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { CATEGORIAS_GASTO, LIMITE_DESCRICAO, LIMITE_TEXTO_CURTO, type CategoriaGasto, type EdicaoGasto, type Gasto, type Obra } from '@obras/shared';
import FolhaInferior from '@/components/campo/FolhaInferior';
import { AreaTexto, Aviso, Botao, Campo, Entrada, Selecao, cn } from '@/components/campo/ui';
import { formatarBRL, formatarData } from '@/components/campo/formatos';
import { hojeLocal } from '@/lib/api';
import { useObras } from '@/store';
import { EntradaReais } from './EntradaReais';

const CATEGORIAS = Object.entries(CATEGORIAS_GASTO) as [CategoriaGasto, string][];

interface Form {
  data: string;
  etapa: string; // código como texto ('' = não escolhida)
  atividade: string; // '' = Geral da etapa
  categoria: CategoriaGasto | '';
  valor: number;
  descricao: string;
  fornecedor: string;
  documento: string;
}

const vazio = (): Form => ({ data: hojeLocal(), etapa: '', atividade: '', categoria: '', valor: 0, descricao: '', fornecedor: '', documento: '' });

const deGasto = (g: Gasto): Form => ({
  data: g.data,
  etapa: String(g.etapaCodigo),
  atividade: g.atividadeId ?? '',
  categoria: g.categoria,
  valor: g.valor,
  descricao: g.descricao,
  fornecedor: g.fornecedor ?? '',
  documento: g.documento ?? '',
});

function validar(f: Form): Partial<Record<keyof Form, string>> {
  const e: Partial<Record<keyof Form, string>> = {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.data)) e.data = 'Informe a data do gasto.';
  if (!f.etapa) e.etapa = 'Escolha a etapa.';
  if (!f.categoria) e.categoria = 'Escolha a categoria.';
  if (!(f.valor > 0)) e.valor = 'Informe um valor maior que zero.';
  if (!f.descricao.trim()) e.descricao = 'Descreva o gasto (ex.: 50 sacos de cimento).';
  else if (f.descricao.trim().length > LIMITE_DESCRICAO) e.descricao = `Use até ${LIMITE_DESCRICAO} caracteres.`;
  return e;
}

/** Novo gasto ou edição. Celular: folha inferior; desktop: diálogo centralizado. */
export default function FormGasto({
  obra,
  aberto,
  aoMudar,
  gasto,
}: {
  obra: Obra;
  aberto: boolean;
  aoMudar: (v: boolean) => void;
  /** Presente = edição. */
  gasto?: Gasto | null;
}) {
  const { lancarGasto, editarGasto } = useObras();
  const [f, setF] = useState<Form>(vazio);
  const [mostrarErros, setMostrarErros] = useState(false);
  const refValor = useRef<HTMLInputElement>(null);
  const editando = !!gasto;

  useEffect(() => {
    if (!aberto) return;
    setF(gasto ? deGasto(gasto) : vazio());
    setMostrarErros(false);
  }, [aberto, gasto]);

  const set = (p: Partial<Form>) => setF((x) => ({ ...x, ...p }));
  const erros = validar(f);
  const err = (k: keyof Form) => (mostrarErros ? erros[k] : undefined);
  const etapa = obra.etapas.find((e) => String(e.codigo) === f.etapa);
  const atividades = etapa?.atividades ?? [];
  const futura = f.data > hojeLocal();

  const mudou = useMemo(() => {
    if (!gasto) return true;
    const o = deGasto(gasto);
    return (Object.keys(o) as (keyof Form)[]).some((k) => (typeof o[k] === 'string' ? String(o[k]).trim() !== String(f[k]).trim() : o[k] !== f[k]));
  }, [gasto, f]);

  const salvar = (continuar: boolean) => {
    if (Object.keys(erros).length) {
      setMostrarErros(true);
      return;
    }
    const comum = {
      data: f.data,
      etapaCodigo: Number(f.etapa),
      categoria: f.categoria as CategoriaGasto,
      valor: Math.round(f.valor * 100) / 100,
      descricao: f.descricao.trim(),
    };
    try {
      if (gasto) {
        // null limpa no PATCH (undefined não sobrevive ao JSON): atividade volta a "Geral da etapa", texto vazio apaga.
        const edicao: EdicaoGasto = {
          ...comum,
          atividadeId: f.atividade || null,
          fornecedor: f.fornecedor.trim() || null,
          documento: f.documento.trim() || null,
        };
        editarGasto(gasto.id, edicao);
        toast.success('Gasto atualizado.');
        aoMudar(false);
        return;
      }
      lancarGasto({
        obraId: obra.id,
        ...comum,
        ...(f.atividade ? { atividadeId: f.atividade } : {}),
        ...(f.fornecedor.trim() ? { fornecedor: f.fornecedor.trim() } : {}),
        ...(f.documento.trim() ? { documento: f.documento.trim() } : {}),
      });
      toast.success(`Gasto de ${formatarBRL(comum.valor)} lançado.`);
      if (continuar) {
        // Mantém data, etapa, atividade, categoria e fornecedor: o comum é lançar várias notas do mesmo dia.
        set({ valor: 0, descricao: '', documento: '' });
        setMostrarErros(false);
        refValor.current?.focus();
      } else aoMudar(false);
    } catch (e) {
      toast.error('Não foi possível lançar o gasto.', { description: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <FolhaInferior
      aberta={aberto}
      aoMudar={aoMudar}
      titulo={editando ? 'Editar gasto' : 'Novo gasto'}
      subtitulo={obra.nome}
      rodape={
        // Celular: salvar em cima, ocupando a largura; Cancelar e "lançar outro" lado a lado (rodapé mais baixo).
        <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
          <Botao variante="secundario" className={cn(editando && 'col-span-2')} onClick={() => aoMudar(false)}>
            Cancelar
          </Botao>
          {!editando && (
            <Botao variante="secundario" onClick={() => salvar(true)}>
              Salvar e lançar outro
            </Botao>
          )}
          <Botao className="order-first col-span-2 sm:order-none" onClick={() => salvar(false)} disabled={editando && !mudou}>
            {editando ? 'Salvar alterações' : 'Salvar gasto'}
          </Botao>
        </div>
      }
    >
      <form
        className="space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          salvar(false);
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Valor" erro={err('valor')} className="col-span-2 sm:col-span-1">
            <EntradaReais ref={refValor} valor={f.valor} aoMudar={(valor) => set({ valor })} invalido={!!err('valor')} />
          </Campo>
          <Campo rotulo="Data" erro={err('data')} ajuda={futura ? undefined : formatarData(f.data)} className="col-span-2 sm:col-span-1">
            <Entrada type="date" value={f.data} onChange={(e) => set({ data: e.target.value })} invalido={!!err('data')} />
          </Campo>
        </div>
        {futura && (
          <Aviso titulo="Data no futuro">
            Este gasto só entra no "Gasto real" a partir de {formatarData(f.data)}. Se já foi pago, use a data de hoje.
          </Aviso>
        )}

        <Campo rotulo="Etapa" erro={err('etapa')}>
          <Selecao value={f.etapa} onChange={(e) => set({ etapa: e.target.value, atividade: '' })} invalido={!!err('etapa')}>
            <option value="">Selecione</option>
            {obra.etapas.map((e) => (
              <option key={e.codigo} value={e.codigo}>
                {e.codigo}. {e.nome}
              </option>
            ))}
          </Selecao>
        </Campo>

        <Campo rotulo="Atividade (opcional)" ajuda={!f.etapa ? 'Escolha a etapa primeiro.' : 'Sem atividade, o gasto entra como "Geral da etapa".'}>
          <Selecao value={f.atividade} onChange={(e) => set({ atividade: e.target.value })} disabled={!f.etapa}>
            <option value="">Geral da etapa</option>
            {atividades.map((a) => (
              <option key={a.id} value={a.id}>
                {a.codigo} {a.nome}
              </option>
            ))}
          </Selecao>
        </Campo>

        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium text-gray-800">Categoria</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Categoria">
            {CATEGORIAS.map(([k, rotulo]) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={f.categoria === k}
                onClick={() => set({ categoria: k })}
                className={cn(
                  'min-h-11 rounded-full border px-4 text-sm transition-colors',
                  f.categoria === k ? 'border-accent bg-accent text-white' : 'border-border bg-surface text-gray-800 hover:bg-gray-50',
                  err('categoria') && f.categoria !== k && 'border-saude-vermelho',
                )}
              >
                {rotulo}
              </button>
            ))}
          </div>
          {err('categoria') && <span className="block text-xs text-saude-vermelho">{err('categoria')}</span>}
        </fieldset>

        <Campo rotulo="Descrição" erro={err('descricao')} ajuda={`${f.descricao.trim().length}/${LIMITE_DESCRICAO}`}>
          <AreaTexto
            value={f.descricao}
            onChange={(e) => set({ descricao: e.target.value })}
            placeholder="Ex.: 50 sacos de cimento CP-II"
            maxLength={LIMITE_DESCRICAO + 20}
            rows={2}
            className={cn(err('descricao') && 'border-saude-vermelho')}
          />
        </Campo>

        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Fornecedor (opcional)" className="col-span-2 sm:col-span-1">
            <Entrada value={f.fornecedor} onChange={(e) => set({ fornecedor: e.target.value })} placeholder="Ex.: Casa do Construtor" autoComplete="off" maxLength={LIMITE_TEXTO_CURTO} />
          </Campo>
          <Campo rotulo="Nº da nota ou recibo (opcional)" className="col-span-2 sm:col-span-1">
            <Entrada value={f.documento} onChange={(e) => set({ documento: e.target.value })} placeholder="Ex.: NF 1234" autoComplete="off" maxLength={LIMITE_TEXTO_CURTO} />
          </Campo>
        </div>
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </FolhaInferior>
  );
}
