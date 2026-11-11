/**
 * Leva 3 (plano 2026-11-11-17-30): adicionar e remover andar (ou unidade, nas geminadas) numa obra já criada.
 * Botão "Andares"/"Unidades" no cabeçalho do Cronograma. Só diretor/engenheiro (quem monta decide).
 * Cada ação salva na hora (atualizarObra + toast), com confirmação, e fica bloqueada com alteração pendente no Cronograma.
 */
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Layers, Plus, Trash2 } from 'lucide-react';
import { adicionarPavimento, motivoBloqueioRemocao, removerPavimento, type Local, type Obra, type TipoPavimento } from '@obras/shared';
import { useObras } from '@/store';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Dica,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';
import { NOMES_PAVIMENTO } from '@/components/campo/formatos';
import { cn } from '@/lib/utils';
import { AVISO_PENDENTE, andaresDaObra, contarEstrutura, nomeAndar, novoIdWeb, tentar } from './estruturaUi';

const TIPOS_PAV = Object.keys(NOMES_PAVIMENTO) as TipoPavimento[];
const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;

/** Diferença de itens/atividades entre a obra atual e o resultado de uma ação. */
function textoDiferenca(antes: Obra, depois: Obra): string {
  const a = contarEstrutura(antes);
  const d = contarEstrutura(depois);
  const partes: string[] = [];
  if (d.itens > a.itens) partes.push(`${plural(d.itens - a.itens, 'item novo', 'itens novos')} no cronograma`);
  if (d.itens < a.itens) partes.push(`${plural(a.itens - d.itens, 'item removido', 'itens removidos')} do cronograma`);
  if (d.atividades < a.atividades) partes.push(`${plural(a.atividades - d.atividades, 'atividade sai', 'atividades saem')} (o valor vai para as outras da etapa)`);
  if (d.itens === a.itens) partes.push('nenhum item muda (as atividades continuam da obra toda até alguém dividir)');
  return partes.join(' · ');
}

/** Sugestão de nome para o novo andar/unidade. */
function nomeSugerido(obra: Obra, tipoPav: TipoPavimento): string {
  const andares = andaresDaObra(obra);
  if (obra.tipo === 'geminadas') return `Casa ${andares.length + 1}`;
  if (tipoPav === 'tipo') return `${andares.filter((l) => l.tipoPavimento === 'tipo').length + 1}º pavimento`;
  return NOMES_PAVIMENTO[tipoPav];
}

/** Posição padrão: tipo → logo acima do último pavimento tipo; subsolo/térreo → embaixo; resto → em cima. */
function posicaoSugerida(andares: Local[], tipoPav: TipoPavimento | undefined): number {
  if (!tipoPav) return andares.length;
  if (tipoPav === 'subsolo_garagem') return 0;
  if (tipoPav === 'terreo' || tipoPav === 'terreo_comercial') {
    const k = andares.findIndex((l) => l.tipoPavimento !== 'subsolo_garagem');
    return k === -1 ? andares.length : k;
  }
  if (tipoPav === 'tipo') {
    const ultimoTipo = andares.map((l) => l.tipoPavimento).lastIndexOf('tipo');
    if (ultimoTipo >= 0) return ultimoTipo + 1;
    const k = andares.findIndex((l) => l.tipoPavimento === 'cobertura' || l.tipoPavimento === 'casa_maquinas');
    return k === -1 ? andares.length : k;
  }
  if (tipoPav === 'cobertura') {
    const k = andares.findIndex((l) => l.tipoPavimento === 'casa_maquinas');
    return k === -1 ? andares.length : k;
  }
  return andares.length;
}

export function EditorAndaresObra({ obra, temMudanca }: { obra: Obra; temMudanca: boolean }) {
  const { atualizarObra } = useObras();
  const nomes = nomeAndar(obra);
  const ehUnidade = obra.tipo === 'geminadas';
  const [aberto, setAberto] = useState(false);
  const [adicionando, setAdicionando] = useState(false);
  const [removendo, setRemovendo] = useState<Local | null>(null);
  const [tipoPav, setTipoPav] = useState<TipoPavimento>('tipo');
  const [nome, setNome] = useState('');
  const [posicao, setPosicao] = useState(0);

  const andares = useMemo(() => andaresDaObra(obra), [obra]);
  const itensPorLocal = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of obra.etapas) for (const a of e.atividades) for (const i of a.itens) m.set(i.localId, (m.get(i.localId) ?? 0) + 1);
    return m;
  }, [obra.etapas]);

  function abrir() {
    if (temMudanca) {
      toast.warning(AVISO_PENDENTE);
      return;
    }
    setAdicionando(false);
    setRemovendo(null);
    setAberto(true);
  }

  function comecarAdicionar() {
    const t: TipoPavimento = andares.length === 0 ? 'terreo' : 'tipo';
    setTipoPav(t);
    setNome(nomeSugerido(obra, t));
    setPosicao(posicaoSugerida(andares, ehUnidade ? undefined : t));
    setRemovendo(null);
    setAdicionando(true);
  }

  function trocarTipo(t: TipoPavimento) {
    // Só troca o nome se ainda era a sugestão (não apaga o que a pessoa digitou).
    if (nome === nomeSugerido(obra, tipoPav)) setNome(nomeSugerido(obra, t));
    setTipoPav(t);
    setPosicao(posicaoSugerida(andares, t));
  }

  const nomeLimpo = nome.trim();
  const nomeRepetido = andares.some((l) => l.nome.trim().toLowerCase() === nomeLimpo.toLowerCase());
  const previaAdicao = adicionando && nomeLimpo
    ? tentar(() => adicionarPavimento(obra, { nome: nomeLimpo, tipo: ehUnidade ? 'unidade' : 'pavimento', tipoPavimento: ehUnidade ? undefined : tipoPav, posicao }, novoIdWeb))
    : null;
  const previaRemocao = removendo ? tentar(() => removerPavimento(obra, removendo.id)) : null;

  function salvar(r: { ok: true; valor: Obra } | { ok: false; erro: string } | null, msg: string) {
    if (!r) return;
    if (!r.ok) {
      toast.error(`Não foi possível salvar: ${r.erro}`);
      return;
    }
    atualizarObra(r.valor);
    toast.success(msg, { description: textoDiferenca(obra, r.valor) });
    setAdicionando(false);
    setRemovendo(null);
  }

  /** Motivo para não poder remover (null = pode). Se a regra ainda não estiver disponível, mostra o erro. */
  const motivo = (l: Local): string | null => {
    const r = tentar(() => motivoBloqueioRemocao(obra, l.id));
    return r.ok ? r.valor : r.erro;
  };

  const opcoesPosicao = andares.length
    ? Array.from({ length: andares.length + 1 }, (_, k) => ({
        valor: k,
        rotulo: ehUnidade
          ? k === 0
            ? `Antes de ${andares[0]!.nome} (a primeira)`
            : `Depois de ${andares[k - 1]!.nome}`
          : k === 0
            ? `Abaixo de ${andares[0]!.nome} (o mais baixo)`
            : `Acima de ${andares[k - 1]!.nome}`,
      }))
    : [];

  return (
    <>
      <Dica texto={temMudanca ? AVISO_PENDENTE : `Adicionar ou remover ${nomes.varios} desta obra`}>
        <Button variant="outline" size="sm" onClick={abrir} aria-disabled={temMudanca} className={cn(temMudanca && 'cursor-not-allowed opacity-60')}>
          <Layers /> {nomes.Titulo}
        </Button>
      </Dica>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {nomes.Titulo} da obra
            </DialogTitle>
            <DialogDescription>
              {ehUnidade ? 'Em ordem.' : 'De baixo para cima.'} Cada mudança é salva na hora. Valores e baseline inicial são redivididos entre os itens de cada atividade.
            </DialogDescription>
          </DialogHeader>

          <ol className="max-h-[40vh] divide-y divide-border overflow-y-auto rounded-lg border border-border">
            {andares.length === 0 && (
              <li className="p-4 text-center text-sm text-muted">
                Esta obra ainda não tem {nomes.varios}. Tudo está em "Obra toda". Ao adicionar {nomes.oPrimeiro}, as atividades continuam da obra toda até alguém dividir na grade
                "Por andar".
              </li>
            )}
            {(ehUnidade ? andares : [...andares].reverse()).map((l, i) => {
              const m = motivo(l);
              const n = itensPorLocal.get(l.id) ?? 0;
              return (
                <li key={l.id} className={cn('flex items-center gap-2 px-3 py-2 text-sm', removendo?.id === l.id && 'bg-saude-vermelho/5')}>
                  <span className="w-6 shrink-0 text-center text-xs tabular-nums text-muted">{ehUnidade ? i + 1 : andares.length - i}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-gray-900">{l.nome}</div>
                    <div className="text-xs text-muted">
                      {l.tipoPavimento ? `${NOMES_PAVIMENTO[l.tipoPavimento]} · ` : ''}
                      {plural(n, 'item', 'itens')}
                    </div>
                  </div>
                  <Dica texto={m ?? `Remover ${l.nome}`} lado="left">
                    {/* span: botão desabilitado não dispara o hover do tooltip */}
                    <span tabIndex={m ? 0 : -1}>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={!!m}
                        onClick={() => {
                          setAdicionando(false);
                          setRemovendo(l);
                        }}
                        aria-label={`Remover ${l.nome}`}
                      >
                        <Trash2 className="text-saude-vermelho" />
                      </Button>
                    </span>
                  </Dica>
                </li>
              );
            })}
          </ol>

          {removendo && (
            <div className="space-y-2 rounded-lg border border-saude-vermelho/40 bg-saude-vermelho/5 px-3 py-2.5 text-sm">
              <div className="font-medium text-gray-900">Remover {removendo.nome}?</div>
              <div className="text-xs text-gray-800">
                {previaRemocao?.ok ? textoDiferenca(obra, previaRemocao.valor) : `Não pode remover: ${previaRemocao?.erro}`}.
                {/* Andar vazio: não há valor para redividir (observação do teste geral, 11/11). */}
                {obra.etapas.some((e) => e.atividades.some((a) => a.itens.some((i) => i.localId === removendo.id))) &&
                  ' O valor dos itens removidos é redividido entre os que ficam na mesma atividade.'}{' '}
                Não dá para desfazer.
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setRemovendo(null)}>
                  Cancelar
                </Button>
                <Button variant="destructive" size="sm" disabled={!previaRemocao?.ok} onClick={() => salvar(previaRemocao, `Removido: ${removendo.nome}.`)}>
                  <Trash2 /> Remover e salvar
                </Button>
              </div>
            </div>
          )}

          {adicionando ? (
            <div className="space-y-3 rounded-lg border border-accent/30 bg-accent/5 px-3 py-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="novo-andar-nome">Nome</Label>
                  <Input id="novo-andar-nome" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
                  {nomeRepetido && <p className="text-xs text-saude-amarelo">Já existe {nomes.umArtigo} com esse nome.</p>}
                </div>
                {!ehUnidade && (
                  <div className="space-y-1.5">
                    <Label>Tipo de pavimento</Label>
                    <Select value={tipoPav} onValueChange={(v) => trocarTipo(v as TipoPavimento)}>
                      <SelectTrigger aria-label="Tipo de pavimento">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIPOS_PAV.map((t) => (
                          <SelectItem key={t} value={t}>
                            {NOMES_PAVIMENTO[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {opcoesPosicao.length > 0 && (
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Posição</Label>
                    <Select value={String(posicao)} onValueChange={(v) => setPosicao(Number(v))}>
                      <SelectTrigger aria-label="Posição">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(ehUnidade ? opcoesPosicao : [...opcoesPosicao].reverse()).map((o) => (
                          <SelectItem key={o.valor} value={String(o.valor)}>
                            {o.rotulo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <div className="text-xs text-gray-800">
                {!nomeLimpo
                  ? 'Digite o nome.'
                  : previaAdicao?.ok
                    ? `${textoDiferenca(obra, previaAdicao.valor)}.${contarEstrutura(previaAdicao.valor).itens > contarEstrutura(obra).itens ? ` Os itens novos começam em 0%, com as datas ${nomes.doVizinho}.` : ''}`
                    : `Não pode adicionar: ${previaAdicao?.erro}`}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setAdicionando(false)}>
                  Cancelar
                </Button>
                <Button size="sm" disabled={!previaAdicao?.ok} onClick={() => salvar(previaAdicao, `Adicionado: ${nomeLimpo}.`)}>
                  <Plus /> Adicionar e salvar
                </Button>
              </div>
            </div>
          ) : (
            !removendo && (
              <Button variant="outline" onClick={comecarAdicionar} className="self-start">
                <Plus /> Adicionar {nomes.um}
              </Button>
            )
          )}

          <DialogFooter>
            <Button onClick={() => setAberto(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
