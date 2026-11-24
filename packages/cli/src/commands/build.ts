import { writeFile } from 'node:fs/promises';
import { getClawFile } from '../util/claw-file.ts';
import Compiler from 'compiler';

export default async function build () {
  const clawFile = getClawFile();
  if (clawFile.type === 'package') {
    throw new Error('Packages cannot be built into projects.');
  }

  const output = clawFile.output || 'project.sb3';
  const compiler = new Compiler();
  await compiler.compile(clawFile.sprites);

  const archive = await compiler.generateZip('nodebuffer');
  await writeFile(output, archive);
}
