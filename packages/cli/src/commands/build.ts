import { writeFile } from 'node:fs/promises';
import Compiler from 'compiler';

export default async function build () {
  const compiler = new Compiler();
  await compiler.compile('main.claw');

  const archive = await compiler.generateZip('nodebuffer');
  await writeFile('main.sb3', archive);
}
