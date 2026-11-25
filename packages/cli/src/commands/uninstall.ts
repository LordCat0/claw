import { rm } from 'node:fs/promises';
import chalk from 'chalk';
import { packageDirectory } from '../config.ts';
import { getClawFile, writeClawFile } from '../util/claw-file.ts';

export default async function uninstall (packages: string[]) {
  if (packages.length === 0) {
    throw new Error('No packages specified. Run claw uninstall <package>.');
  }

  const clawFile = getClawFile();

  if (!clawFile.dependencies) {
    throw new Error('No packages are installed.');
  }

  const dependencies = clawFile.dependencies;
  const missingPackage = packages.find((name) => !dependencies[name]);
  if (missingPackage) {
    throw new Error(`Package '${missingPackage}' is not installed.`);
  }

  const start = Date.now();
  for (const name of packages) {
    await rm(`${packageDirectory}/${name}`, {
      recursive: true
    });

    delete dependencies[name];
  }
  await writeClawFile(clawFile);

  const elapsed = Date.now() - start;
  console.log(`Uninstalled ${chalk.greenBright(packages.length)} packages in ${chalk.yellowBright(elapsed + 'ms')}`);
}
