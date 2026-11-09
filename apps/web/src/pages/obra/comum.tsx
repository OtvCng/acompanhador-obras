/** Peças compartilhadas pelas telas de gestão (Painel, Obras, Detalhe). */
import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Building2, type LucideIcon } from 'lucide-react';
import { etapasEmAndamento, fimPrevisto, indicadoresObra, type Indicadores, type Obra, type StatusObra, type EtapaObra, type ISODate } from '@obras/shared';
import { useObras } from '@/store';
import { Button, Card } from '@/components/ui';
import { cn } from '@/lib/utils';

export const NOMES_STATUS: Record<StatusObra, string> = {
  planejamento: 'Planejamento',
  em_andamento: 'Em andamento',
  pausada: 'Pausada',
  concluida: 'Concluída',
};

export interface ResumoObra {
  obra: Obra;
  ind: Indicadores;
  fim: ISODate;
  etapasAtuais: EtapaObra[];
}

/** Calcula indicadores, fim previsto e etapas em andamento de cada obra (memorizado por obras + hoje). */
export function useResumos(obras: Obra[]): ResumoObra[] {
  const { hoje } = useObras();
  return useMemo(
    () =>
      obras.map((obra) => ({
        obra,
        ind: indicadoresObra(obra, hoje),
        fim: fimPrevisto(obra),
        etapasAtuais: etapasEmAndamento(obra, hoje),
      })),
    [obras, hoje],
  );
}

export function useNomeUsuario(): (id: string | undefined) => string {
  const { usuarios } = useObras();
  return (id) => usuarios.find((u) => u.id === id)?.nome ?? 'Não definido';
}

/** Precisa de atenção: atrasada, em atenção ou com alerta Caixa. */
export function precisaAtencao(r: ResumoObra): boolean {
  return r.ind.faixa === 'atrasada' || r.ind.faixa === 'atencao' || r.ind.alertaCaixa;
}

/** Cor da barra de realizado de acordo com a saúde. */
export function corBarra(faixa: Indicadores['faixa']): string {
  return {
    adiantada: 'bg-saude-verde',
    no_prazo: 'bg-saude-verde',
    atencao: 'bg-saude-amarelo',
    atrasada: 'bg-saude-vermelho',
    nao_iniciada: 'bg-saude-cinza',
    concluida: 'bg-saude-azul',
  }[faixa];
}

export function Kpi({
  titulo,
  valor,
  detalhe,
  icone: Icone,
  tom = 'neutro',
}: {
  titulo: string;
  valor: ReactNode;
  detalhe?: ReactNode;
  icone?: LucideIcon;
  tom?: 'neutro' | 'verde' | 'amarelo' | 'vermelho' | 'azul';
}) {
  const tons = {
    neutro: 'bg-gray-100 text-gray-600',
    verde: 'bg-saude-verde/10 text-saude-verde',
    amarelo: 'bg-saude-amarelo/10 text-saude-amarelo',
    vermelho: 'bg-saude-vermelho/10 text-saude-vermelho',
    azul: 'bg-accent/10 text-accent',
  };
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-medium text-muted">{titulo}</div>
        {Icone && (
          <div className={cn('flex size-7 items-center justify-center rounded-md', tons[tom])}>
            <Icone className="size-4" />
          </div>
        )}
      </div>
      <div className="mt-1 text-2xl font-semibold tracking-tight text-gray-900">{valor}</div>
      {detalhe && <div className="mt-1 text-xs text-muted">{detalhe}</div>}
    </Card>
  );
}

/** Estado vazio padrão (sem obras ainda / store sem dados). */
export function SemObras({ mensagem }: { mensagem?: string }) {
  const { usuarioAtual } = useObras();
  return (
    <Card className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-gray-100 text-muted">
        <Building2 className="size-6" />
      </div>
      <div className="text-sm font-semibold text-gray-900">Nenhuma obra por aqui</div>
      <p className="max-w-md text-sm text-muted">
        {mensagem ?? 'Ainda não há obras visíveis para o seu perfil. Use "Restaurar dados de exemplo" no topo para carregar as 6 obras fictícias.'}
      </p>
      {usuarioAtual.perfil !== 'encarregado' && (
        <Button asChild variant="outline" size="sm">
          <Link to="/obras/nova">Cadastrar nova obra</Link>
        </Button>
      )}
    </Card>
  );
}
