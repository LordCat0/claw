import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { buffer } from 'node:stream/consumers';
import { pipeline } from 'node:stream/promises';
import { after, afterEach, beforeEach, test } from 'node:test';
import { createGunzip, createGzip } from 'node:zlib';
import { extract, pack } from 'tar-stream';

const root = process.cwd();
const directory = await fs.mkdtemp(join(root, '.test-cli-'));
const originalFetch = globalThis.fetch;
const originalReadFile = fs.readFile;
const registryURL = process.env.CLAW_REGISTRY_URL;
process.chdir(directory);

const init = (await import('../src/commands/init.ts')).default;
const install = (await import('../src/commands/install.ts')).default;
const publish = (await import('../src/commands/publish.ts')).default;
const { getRegistryURL } = await import('../src/config.ts');
const { lockFileSchema } = await import('../src/schemas.ts');

beforeEach(async () => {
  for (const name of await fs.readdir(directory)) {
    await fs.rm(join(directory, name), {
      recursive: true,
      force: true
    });
  }
  process.env.CLAW_REGISTRY_URL = 'https://registry.invalid';
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  fs.readFile = originalReadFile;
  syncBuiltinESMExports();
});

after(async () => {
  process.chdir(root);
  if (registryURL === undefined) {
    delete process.env.CLAW_REGISTRY_URL;
  } else {
    process.env.CLAW_REGISTRY_URL = registryURL;
  }
  await fs.rm(directory, {
    recursive: true,
    force: true
  });
});

test('initializes an empty project and supplies the test registry default', async () => {
  await init(['project', 'demo']);
  assert.equal(await fs.readFile('sprites/stage.claw', 'utf8'), 'print("Hello world!");');
  await assert.rejects(init(['project', 'demo']), /already exists/);
  delete process.env.CLAW_REGISTRY_URL;
  assert.equal(getRegistryURL(), 'http://localhost:3000');
});

test('does not publish hidden files or dependency directories', async () => {
  await init(['package', 'demo']);
  await fs.writeFile('.env', 'SECRET=fake');
  for (const name of ['.git', 'node_modules', 'claw_modules']) {
    await fs.mkdir(name);
    await fs.writeFile(join(name, 'secret.txt'), 'fake');
  }
  fs.readFile = async (file, ...args) => {
    if (String(file).endsWith('/.claw/credentials.json')) {
      return JSON.stringify({
        accessToken: 'fake',
        refreshToken: 'fake',
        expiresAt: Date.now() + 3600000,
        clientId: 'fake',
        tokenEndpoint: 'https://auth.invalid'
      });
    }
    return originalReadFile(file, ...args);
  };
  syncBuiltinESMExports();
  globalThis.fetch = async (_url, options) => {
    const archive = extract();
    const files: string[] = [];
    archive.on('entry', (header, stream, next) => {
      files.push(header.name);
      stream.on('end', next);
      stream.resume();
    });
    await pipeline(Readable.from([options!.body]), createGunzip(), archive);
    assert.deepEqual(files.sort(), ['claw.json', 'index.claw']);
    return Response.json({
      name: 'demo',
      version: '1.0.0'
    }, { status: 201 });
  };
  await publish();
});

test('rejects lock entries that could delete files outside claw_modules', () => {
  assert.equal(lockFileSchema.safeParse({
    lockfileVersion: 1,
    dependencies: {
      '../keep': {
        specifier: '1.0.0',
        version: '1.0.0',
        license: '',
        dependencies: {},
        resolved: 'https://registry.invalid/package.tgz',
        integrity: 'sha512-YQ=='
      }
    }
  }).success, false);
});

test('resolves shared dependencies across ranges and removes unused versions', async () => {
  const packages: Record<string, Record<string, {
    dependencies: Record<string, string>;
    archive?: Buffer;
  }>> = {
    base: {
      '1.0.0': { dependencies: {} },
      '2.0.0': { dependencies: { unused: '1.0.0' } },
      '3.0.0': { dependencies: {} }
    },
    wrapper: {
      '1.0.0': { dependencies: { base: '>=1.0.0 <3.0.0' } },
      '2.0.0': { dependencies: { base: '1.0.0 || 2.0.0' } }
    },
    unused: { '1.0.0': { dependencies: {} } },
    constructor: { '1.0.0': { dependencies: {} } },
    cyclea: {
      '1.0.0': { dependencies: { cycleb: '1.0.0' } },
      '2.0.0': { dependencies: { cycleb: '2.0.0' } }
    },
    cycleb: {
      '1.0.0': { dependencies: { cyclea: '2.0.0' } },
      '2.0.0': { dependencies: { cyclea: '1.0.0' } }
    }
  };
  for (const [name, versions] of Object.entries(packages)) {
    for (const [version, pkg] of Object.entries(versions)) {
      const archive = pack();
      const compressed = pipeline(archive, createGzip(), buffer);
      archive.entry({ name: 'claw.json' }, JSON.stringify({
        name,
        version,
        type: 'package',
        main: 'index.claw',
        dependencies: pkg.dependencies
      }));
      archive.entry({ name: 'index.claw' }, '');
      archive.finalize();
      pkg.archive = await compressed;
    }
  }
  const { maxSatisfying } = await import('semver');
  globalThis.fetch = async input => {
    const [, name, requested] = new URL(String(input)).pathname.split('/').slice(1);
    const versions = packages[name];
    if (!requested) {
      return Response.json({ versions: Object.keys(versions) });
    }
    const version = maxSatisfying(Object.keys(versions), decodeURIComponent(requested))!;
    const pkg = versions[version];
    if (String(input).endsWith('/download')) {
      return new Response(pkg.archive);
    }
    return Response.json({
      version,
      license: '',
      dependencies: pkg.dependencies,
      dist: {
        tarball: `/packages/${name}/${version}/download`,
        integrity: `sha512-${createHash('sha512').update(pkg.archive!).digest('base64')}`
      }
    });
  };
  for (const dependencies of [
    {
      base: '^1.0.0',
      wrapper: '1.0.0'
    },
    {
      wrapper: '1.0.0',
      base: '^1.0.0'
    },
    {
      base: '1.0.0 || 3.0.0',
      wrapper: '2.0.0'
    }
  ]) {
    await fs.writeFile('claw.json', JSON.stringify({
      name: 'demo',
      version: '1.0.0',
      type: 'project',
      sprites: {},
      dependencies
    }));
    await fs.rm('claw-lock.json', { force: true });
    await install([]);
    const lock = JSON.parse(await fs.readFile('claw-lock.json', 'utf8'));
    assert.equal(lock.dependencies.base.version, '1.0.0');
    assert.deepEqual(Object.keys(lock.dependencies).sort(), ['base', 'wrapper']);
  }
  await install(['constructor@1.0.0']);
  const manifest = JSON.parse(await fs.readFile('claw_modules/constructor/claw.json', 'utf8'));
  assert.equal(manifest.name, 'constructor');
  await fs.writeFile('claw.json', JSON.stringify({
    name: 'demo',
    version: '1.0.0',
    type: 'project',
    sprites: {},
    dependencies: { cyclea: '*' }
  }));
  await assert.rejects(install([]), /Conflicting versions/);
});
