/**
 * Obras de demonstração no banco. Reaproveita o seed do front (apps/web/src/data/seed.ts, dono: Fundação).
 * Usuários fictícios entram com exemplo = true e sem e-mail/senha (não fazem login).
 */
import { eq } from 'drizzle-orm';
import { criarSeed, HOJE_SEED, USUARIOS } from '../../../web/src/data/seed';
import { db, schema as s } from '../db';
import { gravarObra } from './obras';

export async function recriarExemplos(): Promise<number> {
  const obras = criarSeed(HOJE_SEED);
  await db.transaction(async (tx) => {
    await tx.insert(s.usuarios)
      .values(USUARIOS.map((u) => ({ id: u.id, nome: u.nome, perfil: u.perfil, email: null, senhaHash: null, exemplo: true })))
      .onConflictDoNothing();
    await tx.delete(s.obras).where(eq(s.obras.exemplo, true));
    for (const o of obras) await gravarObra(tx, o, { nova: true, exemplo: true, comHistorico: true });
  });
  return obras.length;
}
