import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import chalk from 'chalk';
import { extract } from 'tar-stream';
import { rcompare, satisfies } from 'semver';
import { getRegistryURL, packageDirectory } from '../config.ts';
import {
  packageNameSchema,
  packageVersionSchema,
  packageVersionsSchema
} from '../schemas.ts';
import {
  getClawLock,
  writeClawLock,
  type ClawLock,
  type LockedDependency
} from '../util/claw-lock.ts';
import { getClawFile, writeClawFile } from '../util/claw-file.ts';

const satisfiesAll = (version: string, constraints: string[]) =>
  constraints.every(specifier =>
    satisfies(version, specifier === 'latest' ? '*' : specifier));

async function resolveDependency(
  name: string,
  specifier: string,
  constraints: string[]
): Promise<LockedDependency> {
  const registryURL = getRegistryURL();
  let requested = specifier;

  if (constraints.length > 1) {
    const response = await fetch(
      `${registryURL}/packages/${encodeURIComponent(name)}`
    );
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} while resolving package ${name}`);
    }

    const metadata = packageVersionsSchema.parse(await response.json());
    requested = metadata.versions
      .sort(rcompare)
      .find(version => satisfiesAll(version, constraints)) || '';

    if (!requested) {
      throw new Error(`Conflicting versions requested for package ${name}.`);
    }
  }

  const response = await fetch(
    `${registryURL}/packages/${encodeURIComponent(name)}`
      + `/${encodeURIComponent(requested)}`
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
    integrity: result.data.dist.integrity
  };
}

async function resolveLock(
  dependencies: Record<string, string>,
  currentLock?: ClawLock,
  refresh: string[] = []
): Promise<ClawLock> {
  const resolved: ClawLock['dependencies'] = Object.create(null);
  const resolving: string[] = [];

  async function addDependency(name: string) {
    const reachable = pruneLock(dependencies, {
      lockfileVersion: 1,
      dependencies: resolved
    });
    const direct = Object.hasOwn(dependencies, name)
      ? dependencies[name]
      : undefined;
    const constraints = [
      direct,
      ...Object.values(reachable.dependencies).map(dependency => {
        const children = dependency.dependencies || {};
        return Object.hasOwn(children, name) ? children[name] : undefined;
      })
    ].filter((value, index, values): value is string =>
      Boolean(value) && values.indexOf(value) === index
    );
    if (!constraints.length) {
      return;
    }

    const specifier = direct || constraints[0];
    const existing = resolved[name];
    if (existing && satisfiesAll(existing.version, constraints)) {
      existing.specifier = specifier;
      return;
    }
    if (resolving.includes(name)) {
      throw new Error(`Conflicting versions requested for package ${name}.`);
    }

    const locked = currentLock?.dependencies[name];
    const dependency = locked?.specifier === specifier
      && locked.dependencies !== undefined
      && !refresh.includes(name)
      && satisfiesAll(locked.version, constraints)
      ? locked
      : await resolveDependency(name, specifier, constraints);

    resolved[name] = dependency;
    resolving.push(name);
    for (const child of Object.keys(
      dependency.dependencies || {}
    )) {
      await addDependency(child);
    }
    resolving.pop();
  }

  for (const name of Object.keys(dependencies)) {
    await addDependency(name);
  }

  return pruneLock(dependencies, {
    lockfileVersion: 1,
    dependencies: resolved
  });
}

export function lockMatches(
  dependencies: Record<string, string>,
  lockFile: ClawLock
) {
  const pending = Object.keys(dependencies);
  const checked: Record<string, boolean> = Object.create(null);

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
    dependencies: Object.create(null)
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
  const response = await fetch(
    `${getRegistryURL()}/packages/${encodeURIComponent(name)}`
      + `/${encodeURIComponent(dependency.version)}/download`
  );
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
