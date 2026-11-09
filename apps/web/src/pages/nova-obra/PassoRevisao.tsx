import { useMemo } from 'react';
import { fimPrevisto, NOMES_TIPO, type Obra, type Usuario } from '@obras/shared';
import { Aviso, Card, SeloEstimativa, SeloNaoConfirmado } from '@/components/campo/ui';
import { formatarBRL, formatarData, formatarNumero } from '@/components/campo/formatos';

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <dt className="text-muted">{rotulo}</dt>
      <dd className="text-right font-medium text-gray-900">{children}</dd>
    </div>
  );
}

export default function PassoRevisao({ obra, usuarios }: { obra: Obra; usuarios: Usuario[] }) {
  const nomeUsuario = (id: string) => usuarios.find((u) => u.id === id)?.nome ?? id;

  const cronograma = useMemo(
    () =>
      obra.etapas.map((e) => {
        const itens = e.atividades.flatMap((a) => a.itens);
        const inicios = itens.map((i) => i.inicioPlanejado).sort();
        const fins = itens.map((i) => i.fimPlanejado).sort();
        return {
          codigo: e.codigo,
          nome: e.nome,
          inicio: inicios[0],
          fim: fins.at(-1),
          itens: itens.length,
          naoConfirmadas: e.atividades.filter((a) => !a.duracaoConfirmada).length,
          estimado: e.valorEstimado,
        };
      }),
    [obra],
  );

  let fim: string | null = null;
  try {
    fim = fimPrevisto(obra);
  } catch {
    fim = null;
  }
  const totalAtividades = obra.etapas.reduce((s, e) => s + e.atividades.length, 0);
  const naoConfirmadas = cronograma.reduce((s, e) => s + e.naoConfirmadas, 0);
  const etapasEstimadas = obra.etapas.filter((e) => e.valorEstimado).length;
  const locais = obra.locais.filter((l) => l.tipo !== 'obra');

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Revisão</h2>
        <p className="text-sm text-muted">Confira tudo antes de salvar. Depois de congelada, a baseline v1 vira a régua de atraso da obra.</p>
      </div>

      {naoConfirmadas > 0 && (
        <Aviso titulo={`${naoConfirmadas} de ${totalAtividades} atividades usam duração NÃO CONFIRMADO`}>
          As durações padrão dos modelos ainda não foram validadas pela construtora. O cronograma abaixo é uma estimativa e pode ser ajustado em Modelos ou depois de criada a
          obra.
        </Aviso>
      )}

      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <Card className="h-fit p-4">
          <h3 className="mb-2 text-sm font-semibold">Resumo</h3>
          <dl className="divide-y divide-border">
            <Linha rotulo="Obra">{obra.nome}</Linha>
            <Linha rotulo="Tipo">{NOMES_TIPO[obra.tipo]}</Linha>
            <Linha rotulo="Endereço">
              {obra.endereco}, {obra.cidade}
            </Linha>
            <Linha rotulo="Área">{formatarNumero(obra.areaM2)} m²</Linha>
            <Linha rotulo="Orçamento">{formatarBRL(obra.orcamentoTotal)}</Linha>
            <Linha rotulo="Engenheiro">{nomeUsuario(obra.engenheiroId)}</Linha>
            <Linha rotulo="Encarregado">{nomeUsuario(obra.encarregadoId)}</Linha>
            <Linha rotulo="Locais">{locais.length > 0 ? `${locais.length} (${locais.map((l) => l.nome).join(', ')})` : 'Obra toda'}</Linha>
            <Linha rotulo="Início">{formatarData(obra.dataInicio)}</Linha>
            <Linha rotulo="Fim previsto">
              {fim ? (
                <span className="inline-flex items-center gap-2">
                  {formatarData(fim)}
                  {naoConfirmadas > 0 && <SeloEstimativa />}
                </span>
              ) : (
                'indisponível'
              )}
            </Linha>
            <Linha rotulo="Etapas com valor estimado">
              {etapasEstimadas} de {obra.etapas.length}
            </Linha>
          </dl>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold">Cronograma gerado por etapa</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">Etapa</th>
                  <th className="px-2 py-2 font-medium">Início</th>
                  <th className="px-2 py-2 font-medium">Fim</th>
                  <th className="px-2 py-2 text-right font-medium">Itens</th>
                  <th className="px-4 py-2 font-medium">Duração</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {cronograma.map((e) => (
                  <tr key={e.codigo}>
                    <td className="px-4 py-2">
                      <span className="mr-1 text-xs text-muted">{e.codigo}.</span>
                      {e.nome}
                    </td>
                    <td className="px-2 py-2 tabular-nums">{formatarData(e.inicio) || '-'}</td>
                    <td className="px-2 py-2 tabular-nums">{formatarData(e.fim) || '-'}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{e.itens}</td>
                    <td className="px-4 py-2">{e.naoConfirmadas > 0 ? <SeloNaoConfirmado /> : <span className="text-xs text-saude-verde">confirmada</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
