// todo: make an actual index.ts file instead of just an output test

import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import Compiler from './compiler.ts';

const compiler = new Compiler();
compiler.compile(fileURLToPath(new URL('../../proto.claw', import.meta.url))).then(() => {
    return compiler.generateZip('nodebuffer');
}).then(arr => {
    fs.writeFileSync(new URL('../../prototype/proto.zip', import.meta.url), arr);
    fs.writeFileSync(new URL('../../prototype/proto.sb3', import.meta.url), arr);
    fs.writeFileSync(new URL('../../prototype/project.json', import.meta.url), JSON.stringify(compiler.toJSON()));
});