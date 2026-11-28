import { rm } from 'node:fs/promises';
import chalk from 'chalk';
import { packageDirectory } from '../config.ts';
import { pruneLock } from './install.ts';
import { getClawFile, writeClawFile } from '../util/claw-file.ts';
import { getClawLock, writeClawLock } from '../util/claw-lock.ts';

export default async function uninstall (packages: string[]) {
  if (packages.length === 0) {
    throw new Error('No packages specified. Run claw uninstall <package>.');
  }

  const clawFile = getClawFile();

  if (!clawFile.dependencies) {
    throw new Error('No packages are installed.');
  }

  const dependencies = clawFile.dependencies;
  const missingPackage = packages.find(
    name => !Object.hasOwn(dependencies, name)
  );
  if (missingPackage) {
    throw new Error(`Package '${missingPackage}' is not installed.`);
  }

  const start = Date.now();
  const lockFile = getClawLock();
  for (const name of packages) {
    delete dependencies[name];
  }

  const nextLockFile = lockFile && pruneLock(dependencies, lockFile);
  const removed = lockFile
    ? Object.keys(lockFile.dependencies).filter(
      name => !nextLockFile?.dependencies[name]
    )
    : packages;
  await Promise.all(removed.map(name => rm(`${packageDirectory}/${name}`, {
    recursive: true,
    force: true
  })));

  await Promise.all([
    writeClawFile(clawFile),
    nextLockFile && writeClawLock(nextLockFile)
  ]);

  const elapsed = Date.now() - start;
  console.log(
    `Uninstalled ${chalk.greenBright(packages.length)} packages in `
      + chalk.yellowBright(elapsed + 'ms')
  );
}
