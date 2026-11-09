/** Login, logout, sessão atual, troca de senha e cadastro de usuários (diretor). */
import type { FastifyInstance } from 'fastify';
import { asc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { db, schema as s } from '../db';
import { abrirSessao, ErroHttp, exigirPerfil, exigirUsuario, fecharSessao } from '../auth/sessao';
import { conferirSenha, hashSenha } from '../auth/senha';
import * as v from '../validacao';

export async function rotasAuth(app: FastifyInstance) {
  // Limite simples contra força bruta: 10 tentativas erradas por e-mail a cada 15 min (memória do processo).
  const falhas = new Map<string, { n: number; ate: number }>();

  app.post('/api/auth/login', async (req, reply) => {
    const { email, senha } = v.login.parse(req.body);
    const f = falhas.get(email);
    if (f && f.n >= 10 && f.ate > Date.now()) throw new ErroHttp(429, 'Muitas tentativas. Aguarde 15 minutos.');
    const [u] = await db.select().from(s.usuarios).where(eq(s.usuarios.email, email));
    const ok = !!u && u.ativo && (await conferirSenha(senha, u.senhaHash));
    if (!ok) {
      const atual = f && f.ate > Date.now() ? f : { n: 0, ate: Date.now() + 15 * 60e3 };
      falhas.set(email, { n: atual.n + 1, ate: atual.ate });
      throw new ErroHttp(401, 'E-mail ou senha incorretos.');
    }
    falhas.delete(email);
    await abrirSessao(reply, u.id);
    return { usuario: { id: u.id, nome: u.nome, email: u.email, perfil: u.perfil } };
  });

  app.post('/api/auth/logout', async (req, reply) => {
    await fecharSessao(req, reply);
    return { ok: true };
  });

  app.get('/api/auth/me', async (req) => ({ usuario: exigirUsuario(req) }));

  app.post('/api/auth/senha', async (req) => {
    const u = exigirUsuario(req);
    const { atual, nova } = v.trocaSenha.parse(req.body);
    const [linha] = await db.select().from(s.usuarios).where(eq(s.usuarios.id, u.id));
    if (!(await conferirSenha(atual, linha?.senhaHash))) throw new ErroHttp(400, 'Senha atual incorreta.');
    await db.update(s.usuarios).set({ senhaHash: await hashSenha(nova) }).where(eq(s.usuarios.id, u.id));
    return { ok: true };
  });

  // -------------------------------------------------------------------------
  // Usuários
  // -------------------------------------------------------------------------
  app.get('/api/usuarios', async (req) => {
    const u = exigirUsuario(req);
    const linhas = await db.select().from(s.usuarios).orderBy(asc(s.usuarios.nome));
    return linhas.map((l) => ({
      id: l.id, nome: l.nome, perfil: l.perfil, ativo: l.ativo, exemplo: l.exemplo,
      ...(u.perfil === 'diretor' ? { email: l.email, temSenha: !!l.senhaHash } : {}),
    }));
  });

  app.post('/api/usuarios', async (req, reply) => {
    exigirPerfil(req, 'diretor');
    const d = v.novoUsuario.parse(req.body);
    const [existe] = await db.select({ id: s.usuarios.id }).from(s.usuarios).where(eq(s.usuarios.email, d.email));
    if (existe) throw new ErroHttp(409, 'Já existe um usuário com este e-mail.');
    const id = `u-${randomUUID()}`;
    await db.insert(s.usuarios).values({ id, nome: d.nome, email: d.email, perfil: d.perfil, senhaHash: await hashSenha(d.senha) });
    reply.code(201);
    return { id, nome: d.nome, email: d.email, perfil: d.perfil, ativo: true, exemplo: false, temSenha: true };
  });

  app.patch<{ Params: { id: string } }>('/api/usuarios/:id', async (req) => {
    const eu = exigirPerfil(req, 'diretor');
    const d = v.edicaoUsuario.parse(req.body);
    const [alvo] = await db.select().from(s.usuarios).where(eq(s.usuarios.id, req.params.id));
    if (!alvo) throw new ErroHttp(404, 'Usuário não encontrado.');
    if (alvo.id === eu.id && (d.ativo === false || (d.perfil && d.perfil !== 'diretor'))) {
      throw new ErroHttp(400, 'Você não pode desativar nem rebaixar o próprio usuário.');
    }
    if (d.email && d.email !== alvo.email) {
      const [outro] = await db.select({ id: s.usuarios.id }).from(s.usuarios).where(eq(s.usuarios.email, d.email));
      if (outro) throw new ErroHttp(409, 'Já existe um usuário com este e-mail.');
    }
    await db.update(s.usuarios).set({
      ...(d.nome ? { nome: d.nome } : {}),
      ...(d.email ? { email: d.email } : {}),
      ...(d.perfil ? { perfil: d.perfil } : {}),
      ...(d.ativo !== undefined ? { ativo: d.ativo } : {}),
      ...(d.senha ? { senhaHash: await hashSenha(d.senha) } : {}),
    }).where(eq(s.usuarios.id, alvo.id));
    // Desativar ou trocar a senha derruba as sessões abertas do usuário.
    if (d.ativo === false || d.senha) await db.delete(s.sessoes).where(eq(s.sessoes.usuarioId, alvo.id));
    const [l] = await db.select().from(s.usuarios).where(eq(s.usuarios.id, alvo.id));
    return { id: l.id, nome: l.nome, email: l.email, perfil: l.perfil, ativo: l.ativo, exemplo: l.exemplo, temSenha: !!l.senhaHash };
  });
}
