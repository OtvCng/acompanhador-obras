import { useState } from 'react';
import { ChevronDown, ChevronUp, Layers, Plus, Trash2 } from 'lucide-react';
import type { TipoPavimento } from '@obras/shared';
import { Botao, Entrada, Selecao } from '@/components/campo/ui';
import { NOMES_PAVIMENTO } from '@/components/campo/formatos';
import { gerarPavimentosTipo, novaChave, nomeTipo, type PavimentoForm } from './estado';

const TIPOS_PAV = Object.keys(NOMES_PAVIMENTO) as TipoPavimento[];

export default function EditorPavimentos({ valor, aoMudar, erro }: { valor: PavimentoForm[]; aoMudar: (v: PavimentoForm[]) => void; erro?: string }) {
  const [n, setN] = useState(String(Math.max(1, valor.filter((p) => p.tipoPavimento === 'tipo').length)));
  const nNum = Number(n);
  const nValido = Number.isInteger(nNum) && nNum >= 1 && nNum <= 40;

  const mover = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= valor.length) return;
    const c = [...valor];
    [c[i], c[j]] = [c[j], c[i]];
    aoMudar(c);
  };
  const alterar = (i: number, p: Partial<PavimentoForm>) => aoMudar(valor.map((x, k) => (k === i ? { ...x, ...p } : x)));
  const remover = (i: number) => aoMudar(valor.filter((_, k) => k !== i));
  const adicionar = () => {
    const qtdTipo = valor.filter((p) => p.tipoPavimento === 'tipo').length;
    aoMudar([...valor, { chave: novaChave(), nome: nomeTipo(qtdTipo + 1), tipoPavimento: 'tipo' }]);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-gray-800">Pavimentos</div>
          <div className="text-xs text-muted">Em ordem de baixo para cima. Cada pavimento vira um local de apontamento.</div>
        </div>
        <div className="flex items-end gap-2">
          <label className="block">
            <span className="sr-only">Quantidade de pavimentos tipo</span>
            <Entrada type="number" min={1} max={40} inputMode="numeric" value={n} onChange={(e) => setN(e.target.value)} className="w-20" invalido={!nValido} />
          </label>
          <Botao variante="secundario" disabled={!nValido} onClick={() => aoMudar(gerarPavimentosTipo(valor, nNum))}>
            <Layers className="size-4" aria-hidden />
            Gerar {nValido ? nNum : 'N'} pavimentos tipo
          </Botao>
        </div>
      </div>

      <ol className="divide-y divide-border rounded-lg border border-border bg-surface">
        {valor.length === 0 && <li className="p-4 text-center text-sm text-muted">Nenhum pavimento. Adicione ou gere os pavimentos tipo.</li>}
        {valor.map((p, i) => (
          <li key={p.chave} className="flex flex-wrap items-center gap-2 p-2 sm:flex-nowrap">
            <span className="w-6 shrink-0 text-center text-xs tabular-nums text-muted">{i + 1}</span>
            <Entrada aria-label={`Nome do pavimento ${i + 1}`} value={p.nome} onChange={(e) => alterar(i, { nome: e.target.value })} className="min-w-0 flex-1" invalido={!p.nome.trim()} />
            <Selecao aria-label={`Tipo do pavimento ${i + 1}`} value={p.tipoPavimento} onChange={(e) => alterar(i, { tipoPavimento: e.target.value as TipoPavimento })} className="w-full sm:w-48">
              {TIPOS_PAV.map((t) => (
                <option key={t} value={t}>
                  {NOMES_PAVIMENTO[t]}
                </option>
              ))}
            </Selecao>
            <div className="ml-auto flex shrink-0">
              <Botao variante="fantasma" tamanho="icone" aria-label="Mover uma posição para cima na lista" disabled={i === 0} onClick={() => mover(i, -1)}>
                <ChevronUp className="size-4" />
              </Botao>
              <Botao variante="fantasma" tamanho="icone" aria-label="Mover uma posição para baixo na lista" disabled={i === valor.length - 1} onClick={() => mover(i, 1)}>
                <ChevronDown className="size-4" />
              </Botao>
              <Botao variante="fantasma" tamanho="icone" aria-label={`Remover ${p.nome || 'pavimento'}`} onClick={() => remover(i)}>
                <Trash2 className="size-4 text-saude-vermelho" />
              </Botao>
            </div>
          </li>
        ))}
      </ol>
      <div className="flex items-center justify-between">
        <Botao variante="secundario" onClick={adicionar}>
          <Plus className="size-4" aria-hidden />
          Adicionar pavimento
        </Botao>
        <span className="text-xs text-muted">{valor.length} pavimento(s)</span>
      </div>
      {erro && <p className="text-sm text-saude-vermelho">{erro}</p>}
    </div>
  );
}
