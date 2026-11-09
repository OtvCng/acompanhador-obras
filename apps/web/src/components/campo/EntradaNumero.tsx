import { useEffect, useRef, useState } from 'react';
import { Entrada } from './ui';
import { lerNumero } from './formatos';

const fmt = (v: number, casas: number) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas, useGrouping: casas === 2 }).format(v);

/**
 * Campo numérico em pt-BR que só confirma o valor ao sair do campo (ou Enter).
 * Enquanto não está em foco, acompanha o valor externo.
 */
export default function EntradaNumero({
  valor,
  aoConfirmar,
  casas = 2,
  min,
  max,
  className,
  rotulo,
  sufixo,
  disabled,
}: {
  valor: number;
  aoConfirmar: (v: number) => void;
  casas?: number;
  min?: number;
  max?: number;
  className?: string;
  rotulo: string;
  sufixo?: string;
  disabled?: boolean;
}) {
  const [texto, setTexto] = useState(fmt(valor, casas));
  const foco = useRef(false);
  const cancelar = useRef(false);
  useEffect(() => {
    if (!foco.current) setTexto(fmt(valor, casas));
  }, [valor, casas]);

  const n = lerNumero(texto);
  const invalido = !Number.isFinite(n) || (min !== undefined && n < min) || (max !== undefined && n > max);

  const confirmar = () => {
    foco.current = false;
    if (invalido || cancelar.current) {
      cancelar.current = false;
      setTexto(fmt(valor, casas));
      return;
    }
    if (Math.abs(n - valor) > 1e-9) aoConfirmar(n);
    setTexto(fmt(n, casas));
  };

  return (
    <div className="relative">
      <Entrada
        aria-label={rotulo}
        inputMode="decimal"
        value={texto}
        disabled={disabled}
        invalido={invalido}
        onFocus={(e) => {
          foco.current = true;
          e.currentTarget.select();
        }}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={confirmar}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            cancelar.current = true;
            e.currentTarget.blur();
          }
        }}
        className={`text-right tabular-nums ${sufixo ? 'pr-8' : ''} ${className ?? ''}`}
      />
      {sufixo && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted">{sufixo}</span>}
    </div>
  );
}
