import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { env } from '../env';
import * as schema from './schema';

// `date` (OID 1082) volta como string ISO, nunca como Date com fuso.
pg.types.setTypeParser(1082, (v) => v);

export const pool = new pg.Pool({ connectionString: env.databaseUrl, max: 10 });
export const db = drizzle(pool, { schema });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export { schema };
