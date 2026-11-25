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
  compiler.on('resolveImport', ({ source, resolve }) => {
    const directory = join(packageDirectory, source);
    const manifestPath = join(directory, 'claw.json');

    if (!existsSync(directory)) {
      throw new Error(
        `Package is not installed. Run claw install ${source}.`
      );
    }

    if (!existsSync(manifestPath)) {
      throw new Error('Its claw.json file is missing.');
    }

    const contents = readFileSync(manifestPath, 'utf8');
    let manifest: unknown;
    try {
      manifest = JSON.parse(contents);
    } catch {
      throw new Error('Its claw.json file is invalid.');
    }

    const result = packageSchema.safeParse(manifest);
    if (!result.success) {
      throw new Error('Its claw.json file is invalid.');
    }

    const main = join(directory, result.data.main);

    if (existsSync(main)) {
      resolve(main);
      return;
    }

    throw new Error(
      `Its main file '${result.data.main}' does not exist.`
    );
  });
  await compiler.compile(clawFile.sprites);

  const archive = await compiler.generateZip('nodebuffer');
  await writeFile(output, archive);
}
