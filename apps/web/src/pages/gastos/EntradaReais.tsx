import { forwardRef } from 'react';
import { Entrada } from '@/components/campo/ui';

const FMT = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Centavos -> "1.234,56". */
export const formatarCentavos = (centavos: number) => FMT.format(centavos / 100);

/** Texto digitado -> centavos, contando só os dígitos (máscara de caixa registradora). */
export function textoParaCentavos(texto: string): number {
  const digitos = texto.replace(/\D/g, '').replace(/^0+/, '').slice(0, 13); // até R$ 99 bilhões
  return digitos ? Number(digitos) : 0;
}

/**
 * Valor em R$ com máscara BR estilo caixa registradora: cada dígito entra pela direita
 * ("1", "12", "123" -> 0,01 · 0,12 · 1,23). No celular abre o teclado numérico e não
 * exige vírgula, que é o que o encarregado precisa no canteiro.
 */
export const EntradaReais = forwardRef<
  HTMLInputElement,
  { valor: number; aoMudar: (v: number) => void; invalido?: boolean; id?: string; 'aria-label'?: string; 'aria-describedby'?: string }
>(function EntradaReais({ valor, aoMudar, invalido, ...rest }, ref) {
  const centavos = Math.round(valor * 100);
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted">R$</span>
      <Entrada
        ref={ref}
        {...rest}
        inputMode="numeric"
        autoComplete="off"
        className="pl-10 text-right tabular-nums"
        invalido={invalido}
        value={centavos > 0 ? formatarCentavos(centavos) : ''}
        placeholder="0,00"
        onChange={(e) => aoMudar(textoParaCentavos(e.target.value) / 100)}
        onFocus={(e) => {
          // cursor no fim: a máscara sempre cresce pela direita
          const el = e.currentTarget;
          requestAnimationFrame(() => el.setSelectionRange(el.value.length, el.value.length));
        }}
      />
    </div>
  );
});
