import { existsSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import z from 'zod';
import { lockFileSchema } from '../schemas.ts';

export type ClawLock = z.infer<typeof lockFileSchema>;
export type LockedDependency = ClawLock['dependencies'][string];

export function getClawLock() {
  if (!existsSync('claw-lock.json')) {
    return;
  }

  let lockFile: unknown;
  try {
    lockFile = JSON.parse(readFileSync('claw-lock.json', 'utf-8'));
  } catch {
    throw new Error('Invalid claw-lock.json file.');
  }

  const result = lockFileSchema.safeParse(lockFile);
  if (!result.success) {
    throw new Error('Invalid claw-lock.json file.');
  }

  return result.data;
}

export function writeClawLock(lockFile: ClawLock) {
  return writeFile(
    'claw-lock.json',
    `${JSON.stringify(lockFile, null, 2)}\n`
  );
}
