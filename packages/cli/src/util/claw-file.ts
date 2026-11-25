import { existsSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { projectSchema, packageSchema } from '../schemas.ts';

export function getClawFile() {
  if (!existsSync('claw.json')) {
    throw new Error('claw.json not found.');
  }

  let clawFile;
  try {
    clawFile = JSON.parse(readFileSync('claw.json', 'utf-8'));
  } catch {
    throw new Error('claw.json is not JSON parsable.');
  }

  const schema = clawFile.type === 'project' ?
    projectSchema : packageSchema;

  const result = schema.safeParse(clawFile);
  if (!result.success) {
    throw new Error(`Invalid claw.json file.\n${result.error}`);
  }

  return result.data;
}

export function writeClawFile(clawFile: ReturnType<typeof getClawFile>) {
  return writeFile(
    'claw.json',
    `${JSON.stringify(clawFile, null, 2)}\n`
  );
}
