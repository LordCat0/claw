import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import chalk from 'chalk';
import { extract } from 'tar-stream';
import { getRegistryURL, packageDirectory } from '../config.ts';
import {
  packageNameSchema,
  packageVersionSchema
} from '../schemas.ts';
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
  const registryURL = getRegistryURL();
  const response = await fetch(
    `${registryURL}/packages/${encodeURIComponent(name)}`
      + `/${encodeURIComponent(specifier)}`
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
    dependencies: result.data.dependencies,
    resolved: `${registryURL}${result.data.dist.tarball}`,
    integrity: result.data.dist.integrity
  };
}

async function resolveLock(
  dependencies: Record<string, string>,
  currentLock?: ClawLock,
  refresh: string[] = []
): Promise<ClawLock> {
  const resolved: ClawLock['dependencies'] = {};

  async function addDependency(
    name: string,
    specifier: string,
    direct = false
  ) {
    const existing = resolved[name];
    if (existing) {
      if (existing.specifier === specifier) {
        return;
      }

      const candidate = await resolveDependency(name, specifier);
      if (candidate.version !== existing.version) {
        throw new Error(`Conflicting versions requested for package ${name}.`);
      }

      if (direct) {
        existing.specifier = specifier;
      }
      return;
    }

    const locked = currentLock?.dependencies[name];
    const dependency = locked?.specifier === specifier
      && locked.dependencies !== undefined
      && !refresh.includes(name)
      ? locked
      : await resolveDependency(name, specifier);

    resolved[name] = dependency;
    for (const [child, childSpecifier] of Object.entries(
      dependency.dependencies || {}
    )) {
      await addDependency(child, childSpecifier);
    }
  }

  for (const [name, specifier] of Object.entries(dependencies)) {
    await addDependency(name, specifier, true);
  }

  return {
    lockfileVersion: 1,
    dependencies: resolved
  };
}

export function lockMatches(
  dependencies: Record<string, string>,
  lockFile: ClawLock
) {
  const pending = Object.keys(dependencies);
  const checked: Record<string, boolean> = {};

  for (const name of pending) {
    const locked = lockFile.dependencies[name];
    if (!locked) {
      return false;
    }

    if (checked[name]) {
      continue;
    }

    if (Object.hasOwn(dependencies, name)
      && locked.specifier !== dependencies[name]) {
      return false;
    }

    checked[name] = true;
    pending.push(...Object.keys(locked.dependencies || {}));
  }

  return Object.keys(checked).length
    === Object.keys(lockFile.dependencies).length;
}

export function pruneLock(
  dependencies: Record<string, string>,
  lockFile: ClawLock
) {
  const pruned: ClawLock = {
    lockfileVersion: 1,
    dependencies: {}
  };
  const pending = Object.keys(dependencies);

  for (const name of pending) {
    if (pruned.dependencies[name]) {
      continue;
    }

    const locked = lockFile.dependencies[name];
    if (!locked) {
      continue;
    }

    pruned.dependencies[name] = locked;
    pending.push(...Object.keys(locked.dependencies || {}));
  }

  return pruned;
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
    const path = resolve(directory, header.name);
    if (header.type !== 'file' || !path.startsWith(directory + sep)) {
      archive.destroy(new Error(`Invalid archive entry: ${header.name}`));
      return;
    }

    mkdir(dirname(path), { recursive: true })
      .then(() => pipeline(stream, createWriteStream(path, { flags: 'wx' })))
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
  const requested: Record<string, string> = {};

  for (const specifier of packages) {
    const [name, version = 'latest', extra] = specifier.split('@');
    if (!packageNameSchema.safeParse(name).success
      || !version || extra !== undefined) {
      throw new Error(`Invalid package specifier: ${specifier}`);
    }

    dependencies[name] = version;
    refresh.push(name);
    requested[name] = version;
  }

  const start = Date.now();
  const lockFile = await resolveLock(
    dependencies,
    getClawLock(),
    refresh
  );

  for (const [name, specifier] of Object.entries(requested)) {
    if (specifier === 'latest') {
      dependencies[name] = lockFile.dependencies[name].version;
      lockFile.dependencies[name].specifier = dependencies[name];
    }
  }

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
