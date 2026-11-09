/** Aplica as migrations SQL de apps/api/drizzle (geradas por `pnpm db:gerar`). */
import path from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from '../db';

export async function migrar() {
  const pasta = process.env.MIGRATIONS_DIR ?? path.resolve(process.cwd(), 'drizzle');
  await migrate(db, { migrationsFolder: pasta });
  console.log(`Migrations aplicadas (${pasta}).`);
}

const direto = process.argv[1] && /migrar\.(ts|js)$/.test(process.argv[1]);
if (direto) {
  await migrar();
  await pool.end();
}
