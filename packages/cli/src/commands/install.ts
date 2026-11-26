import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import chalk from 'chalk';
import { extract } from 'tar-stream';
import { backendURL, packageDirectory } from '../config.ts';
import { packageVersionSchema } from '../schemas.ts';
import {
  getClawLock,
  writeClawLock,
  type ClawLock,
  type LockedDependency
} from '../util/claw-lock.ts';
import { getClawFile, writeClawFile } from '../util/claw-file.ts';

async function resolveDependency(
  name: string,
  specifier: string
): Promise<LockedDependency> {
  const response = await fetch(
    `${backendURL}/packages/${name}/${encodeURIComponent(specifier)}`
  );
  if (response.status === 404) {
    throw new Error(`Package ${name}@${specifier} was not found.`);
  }

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} while resolving package ${name}@${specifier}`
    );
  }

  const result = packageVersionSchema.safeParse(await response.json());
  if (!result.success) {
    throw new Error(`Invalid metadata for package ${name}@${specifier}.`);
  }

  return {
    specifier,
    version: result.data.version,
    license: result.data.license,
    resolved: `${backendURL}${result.data.dist.tarball}`,
    integrity: result.data.dist.integrity
  };
}

async function resolveLock(
  dependencies: Record<string, string>,
  currentLock?: ClawLock,
  refresh: string[] = []
): Promise<ClawLock> {
  const entries = await Promise.all(
    Object.entries(dependencies).map(async ([name, specifier]) => {
      const locked = currentLock?.dependencies[name];
      if (locked?.specifier === specifier && !refresh.includes(name)) {
        return [name, locked] as const;
      }

      return [name, await resolveDependency(name, specifier)] as const;
    })
  );

  return {
    lockfileVersion: 1,
    dependencies: Object.fromEntries(entries)
  };
}

export function lockMatches(
  dependencies: Record<string, string>,
  lockFile: ClawLock
) {
  const names = Object.keys(dependencies);

  return names.length === Object.keys(lockFile.dependencies).length
    && names.every(name => (
      lockFile.dependencies[name]?.specifier === dependencies[name]
    ));
}

async function installPackage(name: string, dependency: LockedDependency) {
  const response = await fetch(dependency.resolved);
  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} while fetching package ${name}@${dependency.version}`
    );
  }

  const content = Buffer.from(await response.arrayBuffer());
  const integrity = `sha512-${createHash('sha512')
    .update(content)
    .digest('base64')}`;
  if (integrity !== dependency.integrity) {
    throw new Error(`Integrity check failed for package ${name}.`);
  }

  const directory = join(packageDirectory, name);
  await rm(directory, {
    recursive: true,
    force: true
  });

  const archive = extract();
  archive.on('entry', (header, stream, next) => {
    const path = join(directory, header.name);
    mkdir(dirname(path), { recursive: true })
      .then(() => pipeline(stream, createWriteStream(path)))
      .then(() => next(), next);
  });

  await pipeline(
    Readable.from([content]),
    createGunzip(),
    archive
  );
}

export async function installLockedPackages(lockFile: ClawLock) {
  await Promise.all(
    Object.entries(lockFile.dependencies).map(([name, dependency]) => (
      installPackage(name, dependency)
    ))
  );
}

export default async function install(packages: string[]) {
  const clawFile = getClawFile();
  const dependencies = clawFile.dependencies || {};
  const refresh: string[] = [];

  for (const specifier of packages) {
    const [name, version = 'latest', extra] = specifier.split('@');
    if (!name || !version || extra !== undefined) {
      throw new Error(`Invalid package specifier: ${specifier}`);
    }

    dependencies[name] = version;
    refresh.push(name);
  }

  const start = Date.now();
  const lockFile = await resolveLock(
    dependencies,
    getClawLock(),
    refresh
  );

  await installLockedPackages(lockFile);

  clawFile.dependencies = dependencies;
  await Promise.all([
    writeClawFile(clawFile),
    writeClawLock(lockFile)
  ]);

  const elapsed = Date.now() - start;
  console.log(
    `Installed ${chalk.greenBright(Object.keys(dependencies).length)} `
      + `package(s) in ${chalk.yellowBright(elapsed + 'ms')}`
  );
}
