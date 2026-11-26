import { cp, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const cli = new URL('../', import.meta.url);
const compiler = new URL('../../compiler/', import.meta.url);

await build({
  entryPoints: [fileURLToPath(new URL('src/compiler.ts', compiler))],
  outfile: fileURLToPath(new URL('dist/compiler/src/compiler.js', cli)),
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node24'
});

await Promise.all([
  mkdir(new URL('dist/internal', cli), { recursive: true }),
  mkdir(new URL('dist/compiler/src/assets', cli), { recursive: true })
]);
await Promise.all([
  cp(
    new URL('src/internal/lists.claw', compiler),
    new URL('dist/internal/lists.claw', cli)
  ),
  cp(
    new URL('src/assets/927d672925e7b99f7813735c484c6922.svg', compiler),
    new URL('dist/compiler/src/assets/927d672925e7b99f7813735c484c6922.svg', cli)
  )
]);
