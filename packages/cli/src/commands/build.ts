import { existsSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { packageDirectory } from '../config.ts';
import { packageSchema } from '../schemas.ts';
import { getClawFile } from '../util/claw-file.ts';
import Compiler from 'compiler';

export default async function build () {
  const clawFile = getClawFile();
  if (clawFile.type === 'package') {
    throw new Error('Packages cannot be built into projects.');
  }

  const output = clawFile.output || 'project.sb3';
  const compiler = new Compiler();
  compiler.on('resolveImport', ({ source, resolve, reject }) => {
    const directory = join(packageDirectory, source);
    const manifest = JSON.parse(
      readFileSync(join(directory, 'claw.json'), 'utf8')
    );
    const main = join(directory, packageSchema.parse(manifest).main);

    if (existsSync(main)) {
      resolve(main);
      return;
    }

    reject(new Error(`Package '${source}' has no main file.`));
  });
  await compiler.compile(clawFile.sprites);

  const archive = await compiler.generateZip('nodebuffer');
  await writeFile(output, archive);
}
