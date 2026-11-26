import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import chalk from 'chalk';
import { packageNameSchema } from '../schemas.ts';

export default async function init(args: string[]) {
  const [type = 'project', name = basename(resolve()), extra] = args;
  if (!['project', 'package'].includes(type) || extra) {
    throw new Error('Run claw init [project|package] [name].');
  }

  if (type === 'package' && !packageNameSchema.safeParse(name).success) {
    throw new Error('Package names must use lowercase letters, numbers, - or _.');
  }

  const source = type === 'project' ? 'stage.claw' : 'index.claw';
  if (existsSync('claw.json') || existsSync(source)) {
    throw new Error('A Claw project already exists here.');
  }

  const manifest = type === 'project'
    ? {
        name,
        version: '1.0.0',
        type,
        sprites: {
          Stage: source
        }
      }
    : {
        name,
        version: '1.0.0',
        type,
        main: source
      };

  await Promise.all([
    writeFile('claw.json', `${JSON.stringify(manifest, null, 2)}\n`),
    writeFile(source, '')
  ]);

  console.log(chalk.green(`Created ${name}.`));
}
