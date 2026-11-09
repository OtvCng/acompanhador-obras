// Empacota a API (e o @obras/shared, que é TypeScript puro) num único dist/server.js para produção.
import { build } from 'esbuild';

const comum = { bundle: true, platform: 'node', format: 'esm', target: 'node22', packages: 'external', sourcemap: true,
  banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" } };
// packages: 'external' deixa fora o node_modules, mas o @obras/shared (workspace) precisa entrar no bundle.
const plugins = [{ name: 'shared-interno', setup(b) { b.onResolve({ filter: /^@obras\/shared$/ }, () => ({ path: new URL('../../packages/shared/src/index.ts', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1') })); } }];
for (const [entrada, saida] of [['src/server.ts', 'dist/server.js'], ['src/scripts/setup.ts', 'dist/setup.js'], ['src/scripts/exemplos.ts', 'dist/exemplos.js'], ['src/scripts/criar-usuario.ts', 'dist/criar-usuario.js']]) {
  await build({ ...comum, entryPoints: [entrada], outfile: saida, plugins });
}
console.log('api: build ok');
