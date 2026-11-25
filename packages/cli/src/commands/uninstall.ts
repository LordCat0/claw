import { rm } from 'node:fs/promises';
import { packageDirectory } from '../config.ts';
import { getClawFile, writeClawFile } from '../util/claw-file.ts';

export default async function uninstall (packages: string[]) {
  const clawFile = getClawFile();

  if (!clawFile.dependencies) {
    return;
  }

  for (const name of packages) {
    if (clawFile.dependencies[name]) {
      await rm(`${packageDirectory}/${name}`, {
        recursive: true
      });

      delete clawFile.dependencies[name];
      await writeClawFile(clawFile);
    }
  }
}
