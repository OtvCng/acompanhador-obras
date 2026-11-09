import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, Plus, Search } from 'lucide-react';
import { NOMES_TIPO, type FaixaSaude, type StatusObra, type TipoObra } from '@obras/shared';
import { useObras, useObrasVisiveis, podeVerValores } from '@/store';
import {
  BarraDupla,
  Button,
  Card,
  Dica,
  Input,
  SaudeBadge,
  SAUDE,
  ORDEM_FAIXAS,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import { formatBRL, formatData, formatPctFracao, formatPP, formatSPI } from '@/lib/format';
import { NOMES_STATUS, SemObras, corBarra, useResumos, type ResumoObra } from './obra/comum';
import { cn } from '@/lib/utils';

type Coluna = 'nome' | 'tipo' | 'realizado' | 'spi' | 'desvio' | 'fim' | 'orcamento';
const TODOS = 'todos';

const ORDEM_FAIXA_NUM: Record<FaixaSaude, number> = Object.fromEntries(ORDEM_FAIXAS.map((f, i) => [f, i])) as Record<FaixaSaude, number>;

function valorOrdenacao(r: ResumoObra, c: Coluna): number | string {
  switch (c) {
    case 'nome':
      return r.obra.nome.toLocaleLowerCase('pt-BR');
    case 'tipo':
      return NOMES_TIPO[r.obra.tipo];
    case 'realizado':
      return r.ind.realizado;
    case 'spi':
      return r.ind.spi ?? Number.POSITIVE_INFINITY;
    case 'desvio':
      return r.ind.desvioPP;
    case 'fim':
      return r.fim;
    case 'orcamento':
      return r.obra.orcamentoTotal;
  }
}

export default function ObrasPage() {
  const { usuarioAtual } = useObras();
  const obras = useObrasVisiveis();
  const resumos = useResumos(obras);
  const navigate = useNavigate();
  const verValores = podeVerValores(usuarioAtual.perfil);
  const podeCriar = usuarioAtual.perfil !== 'encarregado';

  const [busca, setBusca] = useState('');
  const [tipo, setTipo] = useState<string>(TODOS);
  const [faixa, setFaixa] = useState<string>(TODOS);
  const [status, setStatus] = useState<string>(TODOS);
  const [ordem, setOrdem] = useState<{ col: Coluna; asc: boolean }>({ col: 'spi', asc: true });

  const lista = useMemo(() => {
    const q = busca.trim().toLocaleLowerCase('pt-BR');
    const f = resumos.filter(
      (r) =>
        (tipo === TODOS || r.obra.tipo === tipo) &&
        (faixa === TODOS || r.ind.faixa === faixa) &&
        (status === TODOS || r.obra.status === status) &&
        (!q || `${r.obra.nome} ${r.obra.cidade} ${r.obra.endereco}`.toLocaleLowerCase('pt-BR').includes(q)),
    );
    return f.sort((a, b) => {
      const va = valorOrdenacao(a, ordem.col);
      const vb = valorOrdenacao(b, ordem.col);
      const c = typeof va === 'string' ? va.localeCompare(vb as string, 'pt-BR') : va - (vb as number);
      if (c === 0) return ORDEM_FAIXA_NUM[a.ind.faixa] - ORDEM_FAIXA_NUM[b.ind.faixa];
      return ordem.asc ? c : -c;
    });
  }, [resumos, busca, tipo, faixa, status, ordem]);

  const filtrando = busca || tipo !== TODOS || faixa !== TODOS || status !== TODOS;

  function Cab({ col, children, className }: { col: Coluna; children: React.ReactNode; className?: string }) {
    const ativo = ordem.col === col;
    const Icone = !ativo ? ArrowUpDown : ordem.asc ? ArrowUp : ArrowDown;
    return (
      <TableHead className={className}>
        <button
          type="button"
          className={cn('inline-flex cursor-pointer items-center gap-1 hover:text-gray-900', ativo && 'text-gray-900')}
          onClick={() => setOrdem((o) => ({ col, asc: o.col === col ? !o.asc : true }))}
        >
          {children}
          <Icone className="size-3" />
        </button>
      </TableHead>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Obras</h2>
          <p className="text-sm text-muted">
            {lista.length} de {resumos.length} obra{resumos.length === 1 ? '' : 's'}
          </p>
        </div>
        {podeCriar && (
          <Button asChild>
            <Link to="/obras/nova">
              <Plus /> Nova obra
            </Link>
          </Button>
        )}
      </div>

      {obras.length === 0 ? (
        <SemObras />
      ) : (
        <Card>
          <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
            <div className="relative min-w-52 flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input placeholder="Buscar por nome, cidade ou endereço" value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-8" />
            </div>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger className="w-48" aria-label="Filtrar por tipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos os tipos</SelectItem>
                {(Object.keys(NOMES_TIPO) as TipoObra[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {NOMES_TIPO[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={faixa} onValueChange={setFaixa}>
              <SelectTrigger className="w-40" aria-label="Filtrar por saúde">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todas as faixas</SelectItem>
                {ORDEM_FAIXAS.map((f) => (
                  <SelectItem key={f} value={f}>
                    {SAUDE[f].rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-40" aria-label="Filtrar por status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos os status</SelectItem>
                {(Object.keys(NOMES_STATUS) as StatusObra[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {NOMES_STATUS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filtrando && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setBusca('');
                  setTipo(TODOS);
                  setFaixa(TODOS);
                  setStatus(TODOS);
                }}
              >
                Limpar filtros
              </Button>
            )}
          </div>

          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <Cab col="nome">Obra</Cab>
                <Cab col="tipo">Tipo</Cab>
                <TableHead>Status</TableHead>
                <Cab col="realizado" className="min-w-44">
                  Realizado x planejado
                </Cab>
                <Cab col="spi">SPI</Cab>
                <Cab col="desvio">Desvio</Cab>
                <Cab col="fim">Fim previsto</Cab>
                {verValores && <Cab col="orcamento">Orçamento</Cab>}
                <TableHead>Saúde</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.length === 0 && (
                <TableRow>
                  <TableCell colSpan={verValores ? 9 : 8} className="py-10 text-center text-sm text-muted">
                    Nenhuma obra corresponde aos filtros.
                  </TableCell>
                </TableRow>
              )}
              {lista.map((r) => (
                <TableRow key={r.obra.id} className="cursor-pointer" onClick={() => navigate(`/obras/${r.obra.id}`)}>
                  <TableCell>
                    <Link to={`/obras/${r.obra.id}`} className="font-medium text-gray-900 hover:text-accent" onClick={(e) => e.stopPropagation()}>
                      {r.obra.nome}
                    </Link>
                    <div className="text-xs text-muted">{r.obra.cidade}</div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-gray-700">{NOMES_TIPO[r.obra.tipo]}</TableCell>
                  <TableCell className="whitespace-nowrap text-gray-700">{NOMES_STATUS[r.obra.status]}</TableCell>
                  <TableCell>
                    <div className="mb-1 flex justify-between gap-2 text-xs">
                      <b className="text-gray-900">{formatPctFracao(r.ind.realizado)}</b>
                      <span className="text-muted">{formatPctFracao(r.ind.planejado)}</span>
                    </div>
                    <BarraDupla realizado={r.ind.realizado * 100} planejado={r.ind.planejado * 100} corRealizado={corBarra(r.ind.faixa)} />
                  </TableCell>
                  <TableCell className="font-semibold text-gray-900">{formatSPI(r.ind.spi)}</TableCell>
                  <TableCell className={cn('whitespace-nowrap', r.ind.desvioPP < -0.05 ? 'text-saude-vermelho' : 'text-gray-700')}>
                    <span className="inline-flex items-center gap-1">
                      {formatPP(r.ind.desvioPP)}
                      {r.ind.alertaCaixa && (
                        <Dica texto="Desvio maior que 10 pp (critério Caixa)">
                          <AlertTriangle className="size-3.5 text-saude-amarelo" />
                        </Dica>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-gray-700">{formatData(r.fim)}</TableCell>
                  {verValores && <TableCell className="whitespace-nowrap text-gray-700">{formatBRL(r.obra.orcamentoTotal)}</TableCell>}
                  <TableCell>
                    <SaudeBadge faixa={r.ind.faixa} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
