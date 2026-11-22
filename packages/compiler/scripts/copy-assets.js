import { cpSync, rmSync } from 'node:fs';

for (const directory of ['assets', 'internal']) {
  const destination = `dist/src/${directory}`;
  rmSync(destination, {
    recursive: true,
    force: true
  });
  cpSync(`src/${directory}`, destination, { recursive: true });
}
