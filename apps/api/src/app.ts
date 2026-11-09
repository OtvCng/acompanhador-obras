import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { ZodError } from 'zod';
import { pool } from './db';
import { env } from './env';
import { ErroHttp, lerSessao } from './auth/sessao';
import { rotasAuth } from './rotas/auth';
import { rotasObras } from './rotas/obras';
import { rotasModelos } from './rotas/modelos';

export async function criarApp() {
  const app = Fastify({
    logger: { level: env.producao ? 'info' : 'warn' },
    bodyLimit: 20 * 1024 * 1024, // obra grande (prédio 7+) vai inteira no PUT
    trustProxy: true,
  });
  await app.register(cookie);
  app.addHook('preHandler', async (req) => { await lerSessao(req); });

  app.setErrorHandler((erro, req, reply) => {
    if (erro instanceof ErroHttp) return reply.code(erro.status).send({ erro: erro.message });
    if (erro instanceof ZodError) {
      const msg = erro.issues.slice(0, 3).map((i) => `${i.path.join('.') || 'dados'}: ${i.message}`).join('; ');
      return reply.code(400).send({ erro: `Dados inválidos. ${msg}` });
    }
    const status = (erro as { statusCode?: number }).statusCode;
    if (status && status < 500) return reply.code(status).send({ erro: (erro as Error).message });
    req.log.error(erro);
    return reply.code(500).send({ erro: 'Erro interno no servidor.' });
  });

  app.get('/api/saude', async () => {
    await pool.query('select 1');
    return { ok: true };
  });

  await app.register(rotasAuth);
  await app.register(rotasObras);
  await app.register(rotasModelos);
  return app;
}
