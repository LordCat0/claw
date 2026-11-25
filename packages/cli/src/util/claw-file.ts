import { existsSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { projectSchema, packageSchema } from '../schemas.ts';

export function getClawFile() {
  if (!existsSync('claw.json')) {
    throw new Error('claw.json not found.');
  }

  let clawFile: unknown;
  try {
    clawFile = JSON.parse(readFileSync('claw.json', 'utf-8'));
  } catch {
    throw new Error('Invalid claw.json file.');
  }

  const isProject = typeof clawFile === 'object' && clawFile
    && 'type' in clawFile && clawFile.type === 'project';
  const schema = isProject ? projectSchema : packageSchema;

  const result = schema.safeParse(clawFile);
  if (!result.success) {
    throw new Error('Invalid claw.json file.');
  }

  return result.data;
}

export function writeClawFile(clawFile: ReturnType<typeof getClawFile>) {
  return writeFile(
    'claw.json',
    `${JSON.stringify(clawFile, null, 2)}\n`
  );
}
