/** Confere (sem banco) as faixas de custo dos gastos de exemplo: `pnpm exec tsx src/scripts/conferir-gastos-exemplo.ts`. */
import { indicadoresCustoObra, validarLinhasGasto } from '@obras/shared';
import { criarSeed, HOJE_SEED } from '../../../web/src/data/seed';
import { gerarGastosExemplo } from '../repo/gastos-exemplo';

let falhou = false;
for (const o of criarSeed(HOJE_SEED)) {
  const gastos = gerarGastosExemplo(o, HOJE_SEED);
  const ind = indicadoresCustoObra({ ...o, gastos }, HOJE_SEED);
  const futuros = gastos.filter((g) => g.data > HOJE_SEED || g.data < o.dataInicio).length;
  const ruins = gastos.filter((g) => !(g.valor > 0) || Math.abs(g.valor * 100 - Math.round(g.valor * 100)) > 1e-6).length;
  // Os exemplos precisam passar na mesma validação da importação (etapa/atividade existentes etc.).
  const linhas = gastos.map((g) => ({
    data: g.data, etapa: String(g.etapaCodigo), atividade: o.etapas.flatMap((e) => e.atividades).find((a) => a.id === g.atividadeId)?.codigo ?? '',
    categoria: g.categoria, valor: g.valor.toFixed(2), descricao: g.descricao, fornecedor: g.fornecedor ?? '', documento: g.documento ?? '',
  }));
  const invalidas = validarLinhasGasto(o, linhas).filter((l) => l.erros.length).length;
  const pct = ind.desvioPct === null ? '-' : `${(ind.desvioPct * 100).toFixed(1)}%`;
  console.log(`${o.tipo.padEnd(14)} ${o.status.padEnd(12)} gastos ${String(gastos.length).padStart(4)}  feito ${ind.agregado.toFixed(0).padStart(10)}  gasto ${ind.gasto.toFixed(0).padStart(10)}  desvio ${pct.padStart(6)}  faixa ${ind.faixa}  fora-da-data ${futuros} valor-ruim ${ruins} invalidas ${invalidas}`);
  if (futuros || ruins || invalidas) falhou = true;
}
if (falhou) { console.error('FALHOU'); process.exit(1); }
