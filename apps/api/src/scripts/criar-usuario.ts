/**
 * Cria um usuário pela linha de comando (útil se perder o acesso do diretor).
 * Uso: pnpm --filter @obras/api usuario:criar -- --nome "Fulano" --email fulano@x.com --perfil engenheiro [--senha xxxxxxxx]
 * Se o e-mail já existir, redefine a senha dele e reativa.
 */
import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import { eq } from 'drizzle-orm';
import { db, pool, schema as s } from '../db';
import { hashSenha, senhaAleatoria } from '../auth/senha';

const { values } = parseArgs({ args: process.argv.slice(2).filter((a) => a !== "--"), options: { nome: { type: 'string' }, email: { type: 'string' }, perfil: { type: 'string' }, senha: { type: 'string' } } });
const email = values.email?.trim().toLowerCase();
const perfil = values.perfil as 'diretor' | 'engenheiro' | 'encarregado' | undefined;
if (!email || !perfil || !['diretor', 'engenheiro', 'encarregado'].includes(perfil)) {
  console.error('Uso: --email <email> --perfil diretor|engenheiro|encarregado [--nome "Nome"] [--senha xxxxxxxx]');
  process.exit(1);
}
const senha = values.senha || senhaAleatoria();
const [existe] = await db.select().from(s.usuarios).where(eq(s.usuarios.email, email));
if (existe) {
  await db.update(s.usuarios).set({ senhaHash: await hashSenha(senha), ativo: true, perfil }).where(eq(s.usuarios.id, existe.id));
  console.log(`Senha redefinida para ${email}.`);
} else {
  await db.insert(s.usuarios).values({ id: `u-${randomUUID()}`, nome: values.nome ?? email, email, perfil, senhaHash: await hashSenha(senha) });
  console.log(`Usuário criado: ${email} (${perfil}).`);
}
if (!values.senha) console.log(`Senha gerada: ${senha}`);
await pool.end();
