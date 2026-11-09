import { criarApp } from './app';
import { env } from './env';
import { migrar } from './scripts/migrar';

if (process.env.MIGRAR_AO_INICIAR === 'true') await migrar();
const app = await criarApp();
await app.listen({ port: env.port, host: env.host });
console.log(`API do Acompanhador de Obras em http://${env.host}:${env.port}`);
