import assert from 'node:assert/strict';
import { test } from 'node:test';
import { listQuery, packageVersion, publishedPackage, requestedVersion } from '../src/validation.ts';

const manifest = {
  name: 'claw-tools',
  version: '1.2.0',
  type: 'package'
};
const files = {
  'claw.json': JSON.stringify(manifest),
  'index.claw': 'var value = 1;'
};

test('accepts a nested entry point and a dependency range', () => {
  const body = publishedPackage.parse({
    ...manifest,
    main: 'src/main.claw',
    dependencies: { helpers: '^2.0.0' },
    files: {
      'claw.json': JSON.stringify({
        ...manifest,
        main: 'src/main.claw',
        dependencies: { helpers: '^2.0.0' }
      }),
      'src/main.claw': 'var value = 1;'
    }
  });

  assert.equal(body.main, 'src/main.claw');
  assert.deepEqual(body.dependencies, { helpers: '^2.0.0' });
});

test('rejects published files outside the package root', () => {
  for (const path of ['../index.claw', '/index.claw', 'src/../../index.claw']) {
    const result = publishedPackage.safeParse({
      ...manifest,
      files: {
        ...files,
        [path]: 'var value = 2;'
      }
    });

    assert.ok(!result.success, path);
    assert.deepEqual(result.error.issues.map(issue => issue.path), [['files', path]]);
  }
});

test('rejects an omitted entry file and a dependency on the package itself', () => {
  const result = publishedPackage.safeParse({
    ...manifest,
    main: 'missing.claw',
    dependencies: { [manifest.name]: '^1.0.0' },
    files: {
      ...files,
      'claw.json': JSON.stringify({
        ...manifest,
        main: 'missing.claw',
        dependencies: { [manifest.name]: '^1.0.0' }
      })
    }
  });

  assert.ok(!result.success);
  assert.deepEqual(result.error.issues.map(issue => issue.path).sort(), [['dependencies'], ['main']]);
});

test('converts search pagination and enforces page bounds', () => {
  assert.deepEqual(listQuery.parse({
    q: ' claw ',
    sort: 'recent',
    limit: '100',
    offset: '10000'
  }), {
    q: 'claw',
    sort: 'recent',
    limit: 100,
    offset: 10000
  });

  assert.equal(listQuery.safeParse({ limit: '101' }).success, false);
  assert.equal(listQuery.safeParse({ offset: '10001' }).success, false);
});

test('accepts package versions and requested version ranges', () => {
  const version = '2.0.0-rc.1+build.7';
  assert.equal(packageVersion.parse(version), version);
  assert.equal(requestedVersion.parse(version), version);
  assert.equal(requestedVersion.parse('latest'), 'latest');
  assert.equal(requestedVersion.parse('^2.0.0'), '^2.0.0');
  assert.equal(packageVersion.safeParse('latest').success, false);
});
