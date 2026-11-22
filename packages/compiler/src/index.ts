import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import Compiler from './compiler.ts';

const compiler = new Compiler();
const source = fileURLToPath(new URL('../../proto.claw', import.meta.url));

compiler.compile(source).then(async () => {
  const archive = await compiler.generateZip('nodebuffer');
  fs.writeFileSync(new URL('../../prototype/proto.zip', import.meta.url), archive);
  fs.writeFileSync(new URL('../../prototype/proto.sb3', import.meta.url), archive);
  fs.writeFileSync(
    new URL('../../prototype/project.json', import.meta.url),
    JSON.stringify(compiler.toJSON())
  );
});
