import { useEffect, useState } from 'react';
import * as Slider from '@radix-ui/react-slider';
import { Camera, ImageIcon, Minus, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import type { ISODate, Obra } from '@obras/shared';
import FolhaInferior from '@/components/campo/FolhaInferior';
import { AreaTexto, BarraProgresso, Botao, Selo, cn } from '@/components/campo/ui';
import { formatarData, formatarPctInteiro } from '@/components/campo/formatos';
import { proximoNumeroFoto, type ItemCampo } from './itens';

const ATALHOS = [0, 25, 50, 75, 100];

export default function FolhaApontamento({
  obra,
  alvo,
  hoje,
  aoFechar,
  aoSalvar,
}: {
  obra: Obra;
  alvo: ItemCampo | null;
  hoje: ISODate;
  aoFechar: () => void;
  aoSalvar: (a: { itemId: string; percentualNovo: number; observacao?: string; fotos: string[] }) => void;
}) {
  const [pct, setPct] = useState(0);
  const [obs, setObs] = useState('');
  const [fotos, setFotos] = useState<string[]>([]);

  const alvoId = alvo?.item.id;
  useEffect(() => {
    if (alvo) {
      setPct(alvo.item.percentual);
      setObs('');
      setFotos([]);
    }
    // Reinicia só quando troca o item aberto, não a cada recálculo da obra.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alvoId]);

  if (!alvo) return null;
  const atual = alvo.item.percentual;
  const mudou = pct !== atual || obs.trim() !== '' || fotos.length > 0;
  const titulo = `${alvo.atividade.codigo} ${alvo.atividade.nome}`;
  const local = alvo.local && alvo.local.tipo !== 'obra' ? alvo.local.nome : 'Obra toda';
  const ultimo = [...obra.apontamentos].reverse().find((a) => a.itemId === alvo.item.id);

  const adicionarFoto = () => {
    const n = proximoNumeroFoto(obra, hoje, fotos);
    setFotos((f) => [...f, `foto-${hoje}-${n}.jpg`]);
  };

  const salvar = () => {
    if (!mudou) return;
    aoSalvar({ itemId: alvo.item.id, percentualNovo: pct, observacao: obs.trim() || undefined, fotos });
  };

  return (
    <FolhaInferior
      aberta
      aoMudar={(v) => !v && aoFechar()}
      titulo={titulo}
      subtitulo={
        <span>
          {local} · {alvo.etapa.nome}
        </span>
      }
      rodape={
        <div className="flex gap-2">
          <Botao variante="secundario" tamanho="lg" className="flex-1" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao tamanho="lg" className="flex-[2]" disabled={!mudou} onClick={salvar}>
            Salvar {formatarPctInteiro(pct)}
          </Botao>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="rounded-xl bg-gray-50 p-3">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted">Atual</span>
            <span className="text-sm text-muted">
              Previsto até hoje: <strong className="text-gray-900">{formatarPctInteiro(alvo.planejado)}</strong>
            </span>
          </div>
          <div className="mt-1 flex items-center gap-3">
            <span className="text-2xl font-semibold tabular-nums">{formatarPctInteiro(atual)}</span>
            <BarraProgresso valor={atual} />
          </div>
          <div className="mt-1 text-xs text-muted">
            Planejado de {formatarData(alvo.item.inicioPlanejado)} a {formatarData(alvo.item.fimPlanejado)}
            {ultimo && <> · último lançamento em {formatarData(ultimo.data)}</>}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-sm font-medium text-gray-800">Novo avanço</span>
            <span className="text-3xl font-semibold tabular-nums text-gray-900" aria-live="polite">
              {formatarPctInteiro(pct)}
            </span>
          </div>
          <div className="grid grid-cols-5 gap-2" role="group" aria-label="Atalhos de percentual">
            {ATALHOS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setPct(v)}
                aria-pressed={pct === v}
                className={cn(
                  'min-h-14 rounded-xl border text-base font-semibold tabular-nums transition-colors',
                  pct === v ? 'border-accent bg-accent text-white' : 'border-border bg-surface text-gray-900 active:bg-gray-100',
                )}
              >
                {v}%
              </button>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Botao variante="secundario" tamanho="icone" aria-label="Diminuir 1%" onClick={() => setPct((p) => Math.max(0, p - 1))}>
              <Minus className="size-4" />
            </Botao>
            <Slider.Root className="relative flex h-11 flex-1 touch-none select-none items-center" value={[pct]} min={0} max={100} step={1} onValueChange={([v]) => setPct(v)} aria-label="Ajuste fino do percentual">
              <Slider.Track className="relative h-2 grow rounded-full bg-gray-200">
                <Slider.Range className="absolute h-full rounded-full bg-accent" />
              </Slider.Track>
              <Slider.Thumb className="block size-7 rounded-full border-2 border-accent bg-white shadow focus-visible:outline-2 focus-visible:outline-accent" />
            </Slider.Root>
            <Botao variante="secundario" tamanho="icone" aria-label="Aumentar 1%" onClick={() => setPct((p) => Math.min(100, p + 1))}>
              <Plus className="size-4" />
            </Botao>
          </div>
          {pct < atual && <p className="mt-2 text-xs text-saude-amarelo">O novo percentual é menor que o atual ({formatarPctInteiro(atual)}). Confirme se é uma correção.</p>}
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-gray-800">Observação (opcional)</span>
          <AreaTexto value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: faltou material, chuva pela manhã..." rows={3} />
        </label>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-800">Fotos (opcional)</span>
            <Selo>simulação</Selo>
          </div>
          {fotos.length > 0 && (
            <ul className="grid grid-cols-3 gap-2">
              {fotos.map((f) => (
                <li key={f} className="relative">
                  <div className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg bg-gray-200 text-gray-500">
                    <ImageIcon className="size-6" aria-hidden />
                  </div>
                  <div className="mt-1 truncate text-[11px] text-muted" title={f}>
                    {f}
                  </div>
                  <button
                    type="button"
                    onClick={() => setFotos((x) => x.filter((y) => y !== f))}
                    className="absolute -right-1 -top-1 flex size-8 items-center justify-center rounded-full bg-gray-800 text-white shadow"
                    aria-label={`Remover ${f}`}
                  >
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Botao variante="secundario" tamanho="lg" className="w-full" onClick={adicionarFoto}>
            <Camera className="size-5" aria-hidden /> Adicionar foto
          </Botao>
        </div>
      </div>
    </FolhaInferior>
  );
}

export function toastApontamento(nome: string, pct: number) {
  toast.success('Apontamento salvo', { description: `${nome}: ${formatarPctInteiro(pct)}` });
}
