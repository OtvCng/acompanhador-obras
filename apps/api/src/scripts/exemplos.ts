/** Recria as 6 obras de demonstração (apaga só as obras com exemplo = true). */
import { pool } from '../db';
import { recriarExemplos } from '../repo/exemplos';

const n = await recriarExemplos();
console.log(`${n} obras de exemplo recriadas.`);
await pool.end();
