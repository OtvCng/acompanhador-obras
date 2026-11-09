import { useMemo, useState } from 'react';
import { ArrowRight, Camera, Search } from 'lucide-react';
import type { Obra } from '@obras/shared';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui';
import { formatData, formatPct } from '@/lib/format';
import { indexarItens, useNomeUsuario } from './comum';

export function AbaApontamentos({ obra }: { obra: Obra }) {
  const nome = useNomeUsuario();
  const [busca, setBusca] = useState('');
  const idx = useMemo(() => indexarItens(obra), [obra]);

  const lista = useMemo(() => {
    const q = busca.trim().toLocaleLowerCase('pt-BR');
    return [...obra.apontamentos]
      .sort((a, b) => (a.data === b.data ? b.id.localeCompare(a.id) : b.data.localeCompare(a.data)))
      .map((a) => ({ a, loc: idx.get(a.itemId) }))
      .filter(({ a, loc }) => {
        if (!q) return true;
        const txt = `${loc?.atividade.nome ?? ''} ${loc?.local?.nome ?? ''} ${loc?.etapa.nome ?? ''} ${a.observacao ?? ''} ${nome(a.autorId)}`.toLocaleLowerCase('pt-BR');
        return txt.includes(q);
      });
  }, [obra.apontamentos, idx, busca, nome]);

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>Apontamentos</CardTitle>
          <CardDescription>
            {obra.apontamentos.length} lançamento{obra.apontamentos.length === 1 ? '' : 's'} de avanço, do mais recente para o mais antigo. Fotos são ilustrativas (dados de exemplo).
          </CardDescription>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input placeholder="Buscar atividade, local, autor..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-8" />
        </div>
      </CardHeader>
      <CardContent className="px-0">
        {obra.apontamentos.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted">Nenhum apontamento lançado ainda. O encarregado lança o avanço pela tela Campo.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">Data</TableHead>
                <TableHead>Atividade / local</TableHead>
                <TableHead>Avanço</TableHead>
                <TableHead>Autor</TableHead>
                <TableHead>Observação</TableHead>
                <TableHead className="pr-5">Fotos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted">
                    Nenhum apontamento corresponde à busca.
                  </TableCell>
                </TableRow>
              )}
              {lista.map(({ a, loc }) => (
                <TableRow key={a.id}>
                  <TableCell className="whitespace-nowrap pl-5 text-gray-700">{formatData(a.data)}</TableCell>
                  <TableCell>
                    <div className="font-medium text-gray-900">{loc ? `${loc.atividade.codigo} ${loc.atividade.nome}` : 'Item removido'}</div>
                    <div className="text-xs text-muted">
                      {loc?.etapa.nome}
                      {loc?.local && loc.local.tipo !== 'obra' ? ` · ${loc.local.nome}` : ''}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5 tabular-nums">
                      <span className="text-muted">{formatPct(a.percentualAnterior, 0)}</span>
                      <ArrowRight className="size-3.5 text-muted" />
                      <b className="text-gray-900">{formatPct(a.percentualNovo, 0)}</b>
                      <Badge variant={a.percentualNovo >= a.percentualAnterior ? 'verde' : 'vermelho'} className="ml-1">
                        {a.percentualNovo >= a.percentualAnterior ? '+' : ''}
                        {(a.percentualNovo - a.percentualAnterior).toFixed(0)} pp
                      </Badge>
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-gray-700">{nome(a.autorId)}</TableCell>
                  <TableCell className="max-w-80 text-gray-700">{a.observacao || <span className="text-muted">sem observação</span>}</TableCell>
                  <TableCell className="pr-5">
                    {a.fotos.length === 0 ? (
                      <span className="text-xs text-muted">nenhuma</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {a.fotos.map((f) => (
                          <span
                            key={f}
                            className="flex size-10 items-center justify-center rounded-md border border-border bg-gradient-to-br from-slate-200 to-slate-300 text-slate-500"
                            title={`${f} (foto ilustrativa)`}
                          >
                            <Camera className="size-4" />
                          </span>
                        ))}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
