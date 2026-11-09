/** Confere que as obras de exemplo voltam do banco iguais ao seed (estrutura, indicadores e curva S). Rodar logo após db:exemplos. */
import { curvaS, indicadoresObra } from '@obras/shared';
import { criarSeed, HOJE_SEED } from '../../../web/src/data/seed';
import { pool } from '../db';
import { carregarObras } from '../repo/obras';

/** JSON com chaves ordenadas (a ordem das chaves não importa, só os valores). */
const canon = (v: unknown): string => JSON.stringify(v, (_k, x) =>
  x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x);

const seed = criarSeed(HOJE_SEED);
const banco = await carregarObras(seed.map((o) => o.id));
let falhas = 0;
for (const o of seed) {
  const b = banco.find((x) => x.id === o.id);
  if (!b) { console.log(`FALHA ${o.id} não está no banco`); falhas++; continue; }
  const { revisao: _r, exemplo: _e, ...semMeta } = b;
  const iguais = canon(semMeta) === canon(o);
  const ind = JSON.stringify(indicadoresObra(b, HOJE_SEED)) === JSON.stringify(indicadoresObra(o, HOJE_SEED));
  const cs = JSON.stringify(curvaS(b, HOJE_SEED)) === JSON.stringify(curvaS(o, HOJE_SEED));
  console.log(`${iguais && ind && cs ? 'OK  ' : 'FALHA'} ${o.nome}: objeto ${iguais ? 'igual' : 'DIFERENTE'}, indicadores ${ind ? 'iguais' : 'DIFERENTES'}, curva S ${cs ? 'igual' : 'DIFERENTE'}`);
  if (!(iguais && ind && cs)) {
    falhas++;
    if (!iguais) {
      const a = canon(o), c = canon(semMeta);
      let i = 0; while (i < a.length && a[i] === c[i]) i++;
      console.log(`   seed:  ...${a.slice(Math.max(0, i - 80), i + 80)}`);
      console.log(`   banco: ...${c.slice(Math.max(0, i - 80), i + 80)}`);
    }
  }
}
await pool.end();
process.exit(falhas ? 1 : 0);
