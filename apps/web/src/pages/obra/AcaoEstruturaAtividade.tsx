/**
 * Leva 2 (plano 2026-11-11-17-30): na grade "Por andar", alterna uma atividade entre "obra toda" e "por andar".
 * - "Dividir por andar": escolhe os andares (todos marcados) e cria um item por andar.
 * - "Juntar em obra toda": confirma mostrando o % resultante.
 * Salva na hora (atualizarObra + toast). Bloqueado com alteração pendente no Cronograma.
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { Merge, Split } from 'lucide-react';
import { dividirPorAndar, juntarEmObraToda, type Atividade, type Obra } from '@obras/shared';
import { useObras } from '@/store';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Dica } from '@/components/ui';
import { formatBRL, formatData } from '@/lib/format';
import { cn } from '@/lib/utils';
import { AVISO_PENDENTE, andaresDaObra, nomeAndar, novoIdWeb, tentar } from './estruturaUi';

type Modo = 'dividir' | 'juntar' | null;

/** Qual ação cabe à atividade: 1 item em "Obra toda" → dividir; qualquer item em andar (1 ou mais) → juntar. */
export function acaoDaAtividade(obra: Obra, a: Atividade): Modo {
  if (!a.itens.length) return null;
  const local = obra.locais.find((l) => l.id === a.itens[0]!.localId);
  return a.itens.length === 1 && local?.tipo === 'obra' ? 'dividir' : 'juntar';
}

export function AcaoEstruturaAtividade({ obra, atividade, temMudanca }: { obra: Obra; atividade: Atividade; temMudanca: boolean }) {
  const { atualizarObra } = useObras();
  const [aberto, setAberto] = useState<Modo>(null);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const modo = acaoDaAtividade(obra, atividade);
  const andares = andaresDaObra(obra);
  const nomes = nomeAndar(obra);
  if (!modo || (modo === 'dividir' && andares.length === 0)) return null;

  const rotulo = modo === 'dividir' ? `Dividir por ${nomes.um}` : 'Juntar em obra toda';
  const Icone = modo === 'dividir' ? Split : Merge;

  function abrir() {
    if (temMudanca) {
      toast.warning(AVISO_PENDENTE);
      return;
    }
    if (modo === 'dividir') setMarcados(new Set(andares.map((l) => l.id)));
    setAberto(modo);
  }

  function confirmar() {
    const r = tentar(() =>
      aberto === 'dividir' ? dividirPorAndar(obra, atividade.id, novoIdWeb, andares.filter((l) => marcados.has(l.id)).map((l) => l.id)) : juntarEmObraToda(obra, atividade.id, novoIdWeb),
    );
    if (!r.ok) {
      toast.error(`Não foi possível ${aberto === 'dividir' ? 'dividir' : 'juntar'}: ${r.erro}`);
      return;
    }
    atualizarObra(r.valor);
    toast.success(
      aberto === 'dividir'
        ? `${atividade.codigo} ${atividade.nome}: dividida em ${marcados.size} ${marcados.size === 1 ? nomes.um : nomes.varios}.`
        : `${atividade.codigo} ${atividade.nome}: juntada em obra toda.`,
    );
    setAberto(null);
  }

  // ------------------------------------------------ números para os textos
  const total = atividade.itens.reduce((s, i) => s + i.valorOrcado, 0);
  const n = marcados.size;
  const parte = n ? Math.floor((total / n) * 100) / 100 : 0;
  const somaValor = total;
  const pctJunto = atividade.itens.length
    ? Math.round(
        somaValor
          ? atividade.itens.reduce((s, i) => s + i.percentual * i.valorOrcado, 0) / somaValor
          : atividade.itens.reduce((s, i) => s + i.percentual, 0) / atividade.itens.length,
      )
    : 0;
  const ini = atividade.itens.map((i) => i.inicioPlanejado).sort()[0];
  const fim = atividade.itens.map((i) => i.fimPlanejado).sort().at(-1);
  const localDe = (id: string) => obra.locais.find((l) => l.id === id);
  const primeiroItem = [...atividade.itens].sort((x, y) => (localDe(x.localId)?.ordem ?? 0) - (localDe(y.localId)?.ordem ?? 0))[0];

  return (
    <>
      <Dica texto={temMudanca ? AVISO_PENDENTE : rotulo}>
        <button
          className={cn(
            'shrink-0 cursor-pointer rounded p-0.5 text-muted opacity-0 hover:bg-gray-100 hover:text-accent focus:opacity-100 group-hover/ativ:opacity-100',
            temMudanca && 'cursor-not-allowed hover:text-muted',
          )}
          onClick={abrir}
          aria-label={`${rotulo}: ${atividade.codigo} ${atividade.nome}`}
          aria-disabled={temMudanca}
        >
          <Icone className="size-3.5" />
        </button>
      </Dica>

      <Dialog open={aberto === 'dividir'} onOpenChange={(o) => !o && setAberto(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Dividir por {nomes.um}: {atividade.codigo} {atividade.nome}
            </DialogTitle>
            <DialogDescription>
              Hoje a atividade é da obra toda. Marque em quais {nomes.varios} ela acontece: {nomes.cada} vira uma linha própria para lançar o avanço.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted">
              {n} de {andares.length} marcados
            </span>
            <button
              className="cursor-pointer text-accent hover:underline"
              onClick={() => setMarcados(n === andares.length ? new Set() : new Set(andares.map((l) => l.id)))}
            >
              {n === andares.length ? 'Desmarcar todos' : 'Marcar todos'}
            </button>
          </div>
          <ul className="max-h-[40vh] space-y-1 overflow-y-auto">
            {andares.map((l) => (
              <li key={l.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-gray-50">
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--color-accent)]"
                    checked={marcados.has(l.id)}
                    onChange={() =>
                      setMarcados((s) => {
                        const x = new Set(s);
                        if (x.has(l.id)) x.delete(l.id);
                        else x.add(l.id);
                        return x;
                      })
                    }
                  />
                  {l.nome}
                </label>
              </li>
            ))}
          </ul>
          <div className="space-y-1 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-800">
            <p>
              <strong>Valor:</strong> {formatBRL(total)} divididos igualmente{n ? ` (${formatBRL(parte)} por ${nomes.um}, o resto de centavos no último)` : ''}.
            </p>
            <p>
              <strong>Datas e avanço:</strong> todos começam com as datas atuais ({formatData(ini)} a {formatData(fim)}) e o % de hoje ({atividade.itens[0]?.percentual ?? 0}%).
            </p>
            <p>
              <strong>Baseline inicial:</strong> cada {nomes.um} recebe as datas da baseline da atividade, com o valor dividido do mesmo jeito.
            </p>
            <p className="text-muted">O histórico de avanços já lançados fica n{nomes.oPrimeiro} {nomes.marcado}.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(null)}>
              Cancelar
            </Button>
            <Button onClick={confirmar} disabled={n === 0}>
              <Split /> Dividir em {n} {n === 1 ? nomes.um : nomes.varios}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={aberto === 'juntar'} onOpenChange={(o) => !o && setAberto(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Juntar em obra toda: {atividade.codigo} {atividade.nome}
            </DialogTitle>
            <DialogDescription>
              {atividade.itens.length === 1
                ? `Hoje a atividade só está em ${localDe(atividade.itens[0]!.localId)?.nome ?? nomes.oPrimeiro}. Ela passa a ser da obra toda.`
                : `As ${atividade.itens.length} linhas por ${nomes.um} viram uma só, da obra toda.`}
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-[30vh] space-y-0.5 overflow-y-auto rounded-md border border-border px-3 py-2 text-xs text-gray-800">
            {[...atividade.itens]
              .sort((x, y) => (localDe(x.localId)?.ordem ?? 0) - (localDe(y.localId)?.ordem ?? 0))
              .map((i) => (
                <li key={i.id} className="flex justify-between gap-2">
                  <span>{localDe(i.localId)?.nome ?? 'Local'}</span>
                  <span className="tabular-nums text-muted">
                    {i.percentual}% · {formatBRL(i.valorOrcado)}
                  </span>
                </li>
              ))}
          </ul>
          <div className="space-y-1 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-800">
            <p>
              <strong>% resultante: {pctJunto}%</strong> {atividade.itens.length > 1 ? `(média pelo valor de ${nomes.cada === 'cada uma' ? 'cada unidade' : 'cada andar'})` : '(o mesmo de hoje)'}.
            </p>
            <p>
              <strong>Valor:</strong> {formatBRL(total)} · <strong>Datas:</strong> {formatData(ini)} a {formatData(fim)} {atividade.itens.length > 1 ? '(do primeiro início ao último fim)' : '(as mesmas)'}. A baseline inicial faz o mesmo.
            </p>
            <p className="text-muted">
              O histórico de avanços continua na mesma linha{atividade.itens.length > 1 ? ` (a de ${localDe(primeiroItem?.localId ?? '')?.nome ?? nomes.oPrimeiro}); os avanços d${nomes.outros === 'outras' ? 'as outras unidades' : 'os outros andares'} ficam no histórico, sem linha` : ''}.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(null)}>
              Cancelar
            </Button>
            <Button onClick={confirmar}>
              <Merge /> Juntar em obra toda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
