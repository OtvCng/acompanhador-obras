/**
 * Primitivos da Telas-Campo. Delegam aos de components/ui (Telas-Gestão) para manter o mesmo visual,
 * acrescentando o que o campo precisa: área de toque >= 44px, avisos, estados vazios e selos de estimativa.
 */
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, AlertTriangle, Info } from 'lucide-react';
import { Badge, Button, Card as CardUI } from '@/components/ui';
import { cn } from '@/lib/utils';

export { cn };

export function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <CardUI className={className} {...rest}>
      {children}
    </CardUI>
  );
}

type Variante = 'primario' | 'secundario' | 'fantasma' | 'perigo';
const VARIANTES = { primario: 'default', secundario: 'outline', fantasma: 'ghost', perigo: 'destructive' } as const;

export const Botao = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; tamanho?: 'md' | 'lg' | 'icone' }>(
  function Botao({ className, variante = 'primario', tamanho = 'md', ...rest }, ref) {
    return (
      <Button
        ref={ref}
        variant={VARIANTES[variante]}
        className={cn(
          'h-auto min-h-11 rounded-lg',
          tamanho === 'md' && 'px-4',
          tamanho === 'lg' && 'min-h-12 px-5 text-base',
          tamanho === 'icone' && 'min-w-11 px-0',
          className,
        )}
        {...rest}
      />
    );
  },
);

const campoBase =
  'w-full min-h-11 rounded-lg border border-border bg-surface px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:bg-gray-50';

export const Entrada = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalido?: boolean }>(function Entrada(
  { className, invalido, ...rest },
  ref,
) {
  return <input ref={ref} className={cn(campoBase, invalido && 'border-saude-vermelho', className)} {...rest} />;
});

export function Selecao({ className, invalido, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { invalido?: boolean }) {
  return <select className={cn(campoBase, 'pr-8', invalido && 'border-saude-vermelho', className)} {...rest} />;
}

export function AreaTexto({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(campoBase, 'min-h-20 py-2', className)} {...rest} />;
}

export function Campo({ rotulo, erro, ajuda, children, className }: { rotulo: string; erro?: string; ajuda?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cn('block space-y-1.5', className)}>
      <span className="text-sm font-medium text-gray-800">{rotulo}</span>
      {children}
      {erro ? <span className="block text-xs text-saude-vermelho">{erro}</span> : ajuda ? <span className="block text-xs text-muted">{ajuda}</span> : null}
    </label>
  );
}

type Tom = 'neutro' | 'verde' | 'amarelo' | 'vermelho' | 'azul' | 'cinza';

export function Selo({ tom = 'neutro', className, children }: { tom?: Tom; className?: string; children: ReactNode }) {
  return (
    <Badge variant={tom === 'neutro' ? 'secondary' : tom} className={className}>
      {children}
    </Badge>
  );
}

export function SeloEstimativa({ className }: { className?: string }) {
  return (
    <Badge variant="estimativa" className={className}>
      estimativa
    </Badge>
  );
}

export function SeloNaoConfirmado({ className }: { className?: string }) {
  return (
    <Badge variant="estimativa" className={cn('uppercase tracking-wide', className)}>
      NÃO CONFIRMADO
    </Badge>
  );
}

export function Aviso({ tom = 'amarelo', titulo, children, className }: { tom?: 'amarelo' | 'azul' | 'vermelho'; titulo?: string; children?: ReactNode; className?: string }) {
  const Icone = tom === 'azul' ? Info : AlertTriangle;
  const cores = {
    amarelo: 'border-amber-200 bg-amber-50 text-amber-900',
    azul: 'border-blue-200 bg-blue-50 text-blue-900',
    vermelho: 'border-red-200 bg-red-50 text-red-900',
  }[tom];
  return (
    <div className={cn('flex gap-3 rounded-lg border p-3 text-sm', cores, className)} role={tom === 'vermelho' ? 'alert' : 'status'}>
      <Icone className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="space-y-1">
        {titulo && <div className="font-medium">{titulo}</div>}
        {children && <div className="opacity-90">{children}</div>}
      </div>
    </div>
  );
}

export function EstadoVazio({ icone, titulo, children, acao }: { icone?: ReactNode; titulo: string; children?: ReactNode; acao?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-12 text-center">
      {icone && <div className="mb-3 text-gray-400">{icone}</div>}
      <div className="font-medium text-gray-900">{titulo}</div>
      {children && <div className="mt-1 max-w-md text-sm text-muted">{children}</div>}
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  );
}

export function BarraProgresso({ valor, className, cor = 'bg-accent' }: { valor: number; className?: string; cor?: string }) {
  const v = Math.max(0, Math.min(100, valor));
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-gray-100', className)} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn('h-full rounded-full transition-all', cor)} style={{ width: `${v}%` }} />
    </div>
  );
}

/** Diálogo de confirmação (substitui confirm()). */
export function DialogoConfirmar({
  aberto,
  aoMudar,
  titulo,
  descricao,
  rotuloConfirmar,
  aoConfirmar,
  perigo,
}: {
  aberto: boolean;
  aoMudar: (v: boolean) => void;
  titulo: string;
  descricao: ReactNode;
  rotuloConfirmar: string;
  aoConfirmar: () => void;
  perigo?: boolean;
}) {
  return (
    <Dialog.Root open={aberto} onOpenChange={aoMudar}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-surface p-5 shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <Dialog.Title className="text-base font-semibold">{titulo}</Dialog.Title>
            <Dialog.Close className="-m-2 rounded p-2 text-muted hover:bg-gray-100" aria-label="Fechar">
              <X className="size-4" />
            </Dialog.Close>
          </div>
          <Dialog.Description asChild>
            <div className="mt-2 text-sm text-muted">{descricao}</div>
          </Dialog.Description>
          <div className="mt-5 flex justify-end gap-2">
            <Botao variante="secundario" onClick={() => aoMudar(false)}>
              Cancelar
            </Botao>
            <Botao
              variante={perigo ? 'perigo' : 'primario'}
              onClick={() => {
                aoConfirmar();
                aoMudar(false);
              }}
            >
              {rotuloConfirmar}
            </Botao>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
