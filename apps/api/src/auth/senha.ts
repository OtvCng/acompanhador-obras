/** Hash de senha com scrypt nativo do Node (sem dependência nativa extra). */
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto';

const N = 16384, R = 8, P = 1, LEN = 64, MAXMEM = 64 * 1024 * 1024;

function scrypt(senha: string, salt: Buffer, len: number, o: ScryptOptions): Promise<Buffer> {
  return new Promise((ok, erro) => scryptCb(senha, salt, len, o, (e, h) => (e ? erro(e) : ok(h))));
}

export async function hashSenha(senha: string): Promise<string> {
  const salt = randomBytes(16);
  const h = await scrypt(senha, salt, LEN, { N, r: R, p: P, maxmem: MAXMEM });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${h.toString('base64')}`;
}

export async function conferirSenha(senha: string, guardado: string | null | undefined): Promise<boolean> {
  if (!guardado) return false;
  const [alg, n, r, p, salt, hash] = guardado.split('$');
  if (alg !== 'scrypt' || !salt || !hash) return false;
  const esperado = Buffer.from(hash, 'base64');
  const h = await scrypt(senha, Buffer.from(salt, 'base64'), esperado.length, { N: Number(n), r: Number(r), p: Number(p), maxmem: MAXMEM });
  return h.length === esperado.length && timingSafeEqual(h, esperado);
}

export const novoToken = () => randomBytes(32).toString('base64url');
export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');
export const senhaAleatoria = () => randomBytes(9).toString('base64url');
