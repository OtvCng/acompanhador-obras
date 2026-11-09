import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, HardHat, MapPin, UserRound } from 'lucide-react';
import { NOMES_TIPO, type Indicadores, type Obra } from '@obras/shared';
import { Badge, Card, Dica, SAUDE, SaudeBadge } from '@/components/ui';
import { formatData } from '@/lib/format';
import { NOMES_STATUS, useNomeUsuario } from './comum';
import { cn } from '@/lib/utils';

export function Cabecalho({ obra, ind }: { obra: Obra; ind: Indicadores }) {
  const nome = useNomeUsuario();
  const base = obra.baselines.at(-1);
  return (
    <Card className={cn('border-b-4 p-4 lg:p-5', SAUDE[ind.faixa].borderB)}>
      <div className="flex flex-wrap items-start gap-3">
        <Link to="/obras" className="mt-0.5 rounded-md p-1 text-muted hover:bg-gray-100 hover:text-gray-900" aria-label="Voltar para obras">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">{obra.nome}</h2>
            <SaudeBadge faixa={ind.faixa} />
            {/* Obra com baseline mas início no futuro: "Não iniciada" já diz tudo; "Em andamento" ao lado confunde. "Concluída" também não se repete. */}
            {!(ind.faixa === 'nao_iniciada' && obra.status === 'em_andamento') && !(ind.faixa === 'concluida' && obra.status === 'concluida') && (
              <Badge variant="secondary">{NOMES_STATUS[obra.status]}</Badge>
            )}
            {base ? (
              <Dica texto={`Congelada em ${formatData(base.congeladaEm)}${base.justificativa ? `: ${base.justificativa}` : ''}`}>
                <Badge variant="outline">Baseline v{base.versao}</Badge>
              </Dica>
            ) : (
              <Badge variant="estimativa">Sem baseline</Badge>
            )}
            {ind.alertaCaixa && (
              <Badge variant="amarelo">
                <AlertTriangle /> Alerta Caixa
              </Badge>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
            <span>{NOMES_TIPO[obra.tipo]}</span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" />
              {obra.endereco}, {obra.cidade}
            </span>
            <span className="inline-flex items-center gap-1">
              <UserRound className="size-3.5" />
              Engenheiro: <span className="text-gray-800">{nome(obra.engenheiroId)}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <HardHat className="size-3.5" />
              Encarregado: <span className="text-gray-800">{nome(obra.encarregadoId)}</span>
            </span>
            <span>Início {formatData(obra.dataInicio)}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
