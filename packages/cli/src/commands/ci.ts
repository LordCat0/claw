import { rm } from 'node:fs/promises';
import chalk from 'chalk';
import { packageDirectory } from '../config.ts';
import { installLockedPackages, lockMatches } from './install.ts';
import { getClawFile } from '../util/claw-file.ts';
import { getClawLock } from '../util/claw-lock.ts';

export default async function ci() {
  const clawFile = getClawFile();
  const lockFile = getClawLock();
  if (!lockFile) {
    throw new Error('claw-lock.json not found. Run claw install.');
  }

  if (!lockMatches(clawFile.dependencies || {}, lockFile)) {
    throw new Error(
      'claw.json and claw-lock.json are out of sync. Run claw install.'
    );
  }

  const start = Date.now();
  await rm(packageDirectory, {
    recursive: true,
    force: true
  });
  await installLockedPackages(lockFile);

  const elapsed = Date.now() - start;
  console.log(
    `Installed ${chalk.greenBright(Object.keys(lockFile.dependencies).length)} `
      + `package(s) in ${chalk.yellowBright(elapsed + 'ms')}`
  );
}
