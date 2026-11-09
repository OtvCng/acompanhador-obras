/** Sessão por cookie httpOnly. O banco guarda só o SHA-256 do token. */
import type { FastifyReply, FastifyRequest } from 'fastify';
import { and, eq, gt } from 'drizzle-orm';
import type { Perfil } from '@obras/shared';
import { db, schema as s } from '../db';
import { env } from '../env';
import { hashToken, novoToken } from './senha';

export const COOKIE = 'sid';
const VALIDADE_DIAS = 30;

export interface UsuarioSessao { id: string; nome: string; email: string | null; perfil: Perfil }

declare module 'fastify' {
  interface FastifyRequest { usuario?: UsuarioSessao }
}

export class ErroHttp extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function abrirSessao(reply: FastifyReply, usuarioId: string) {
  const token = novoToken();
  const expiraEm = new Date(Date.now() + VALIDADE_DIAS * 864e5);
  await db.insert(s.sessoes).values({ id: hashToken(token), usuarioId, expiraEm });
  reply.setCookie(COOKIE, token, { path: '/', httpOnly: true, sameSite: 'lax', secure: env.cookieSecure, expires: expiraEm });
}

export async function fecharSessao(req: FastifyRequest, reply: FastifyReply) {
  const token = req.cookies[COOKIE];
  if (token) await db.delete(s.sessoes).where(eq(s.sessoes.id, hashToken(token)));
  reply.clearCookie(COOKIE, { path: '/' });
}

/** Lê o cookie e preenche req.usuario (ou deixa vazio). */
export async function lerSessao(req: FastifyRequest) {
  const token = req.cookies[COOKIE];
  if (!token) return;
  const [u] = await db
    .select({ id: s.usuarios.id, nome: s.usuarios.nome, email: s.usuarios.email, perfil: s.usuarios.perfil })
    .from(s.sessoes)
    .innerJoin(s.usuarios, eq(s.usuarios.id, s.sessoes.usuarioId))
    .where(and(eq(s.sessoes.id, hashToken(token)), gt(s.sessoes.expiraEm, new Date()), eq(s.usuarios.ativo, true)));
  if (u) req.usuario = u;
}

export function exigirUsuario(req: FastifyRequest): UsuarioSessao {
  if (!req.usuario) throw new ErroHttp(401, 'Faça login para continuar.');
  return req.usuario;
}

export function exigirPerfil(req: FastifyRequest, ...perfis: Perfil[]): UsuarioSessao {
  const u = exigirUsuario(req);
  if (!perfis.includes(u.perfil)) throw new ErroHttp(403, 'Seu perfil não tem permissão para esta ação.');
  return u;
}
