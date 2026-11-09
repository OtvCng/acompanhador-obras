/**
 * Primeiro acesso: migrations + diretor inicial (se ainda não houver nenhum usuário com login).
 * E-mail/nome/senha vêm do .env (ADMIN_*). Senha vazia = gera uma aleatória e imprime UMA vez.
 */
import { randomUUID } from 'node:crypto';
import { isNotNull } from 'drizzle-orm';
import { db, pool, schema as s } from '../db';
import { hashSenha, senhaAleatoria } from '../auth/senha';
import { migrar } from './migrar';

await migrar();

const comLogin = await db.select({ id: s.usuarios.id }).from(s.usuarios).where(isNotNull(s.usuarios.senhaHash)).limit(1);
if (comLogin.length > 0) {
  console.log('Já existe usuário com login. Nenhum diretor criado.');
} else {
  const email = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  const nome = (process.env.ADMIN_NOME ?? 'Diretor').trim();
  if (!email) throw new Error('Defina ADMIN_EMAIL no .env de apps/api.');
  const gerada = !process.env.ADMIN_SENHA;
  const senha = process.env.ADMIN_SENHA || senhaAleatoria();
  await db.insert(s.usuarios).values({ id: `u-${randomUUID()}`, nome, email, perfil: 'diretor', senhaHash: await hashSenha(senha) });
  console.log(`Diretor criado: ${nome} <${email}>`);
  if (gerada) console.log(`Senha gerada (anote, não aparece de novo): ${senha}`);
}
await pool.end();
