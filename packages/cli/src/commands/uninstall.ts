import { rm } from 'node:fs/promises';
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

  for (const name of packages) {
    await rm(`${packageDirectory}/${name}`, {
      recursive: true
    });

    delete dependencies[name];
    await writeClawFile(clawFile);
  }
}
