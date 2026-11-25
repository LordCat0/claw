import { mkdir } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { dirname, join } from 'node:path';
import { createGunzip } from 'node:zlib';
import { extract } from 'tar-stream';
import chalk from 'chalk';
import { backendURL, packageDirectory } from '../config.ts';
import { getClawFile, writeClawFile } from '../util/claw-file.ts';

export default async function install(packages: string[]) {
  if (packages.length === 0) {
    throw new Error(
      'No packages specified. Run claw install <package[@version]>.'
    );
  }

  const clawFile = getClawFile();

  const start = Date.now();
  for (const specifier of packages) {
    const [name, version = 'latest', extra] = specifier.split('@');
    if (!version || extra !== undefined) {
      throw new Error(`Invalid package specifier: ${specifier}`);
    }

    const response = await fetch(
      `${backendURL}/packages/${name}/${encodeURIComponent(version)}/download`
    );
    if (response.status === 404) {
      throw new Error(`Package ${name}@${version} was not found.`);
    }

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status} while fetching package ${name}@${version}`
      );
    }

    const archive = extract();
    archive.on('entry', (header, stream, next) => {
      const path = join(packageDirectory, name, header.name);
      mkdir(dirname(path), { recursive: true })
        .then(() => pipeline(stream, createWriteStream(path)))
        .then(() => next(), next);
    });

    await pipeline(response.body!, createGunzip(), archive);

    clawFile.dependencies ||= {};
    clawFile.dependencies[name] = version;
  }

  await writeClawFile(clawFile);
  const elapsed = Date.now() - start;
  console.log(`Installed ${chalk.greenBright(packages.length)} package(s) in ${chalk.yellowBright(elapsed + 'ms')}`);
}
