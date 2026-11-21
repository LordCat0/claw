import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import './env.ts';
import database from '../src/services/database.ts';
import { publishBody } from '../src/validation.ts';

const body = publishBody.parse({
  name: 'claw-tools',
  version: '1.2.0',
  files: { 'index.claw': 'var value = 1;' }
});
const dist = {
  tarball: `/packages/${body.name}/${body.version}/download`,
  integrity: 'sha512-unused',
  size: 1
};

function mockPublishTransaction(mock: TestContext['mock']) {
  const query = mock.fn(async (sql: string, _values?: string[]) => {
    if (sql.trimStart().startsWith('SELECT publisher_id')) {
      return { rows: [{ publisherId: 'owner' }] };
    }
    return { rows: [] };
  });
  const release = mock.fn();
  mock.method(database.pool, 'connect', async () => ({
    query,
    release
  }));
  mock.method(database.pool, 'query', () => assert.fail('Expected a transaction client'));
  return {
    query,
    release
  };
}

test('checks ownership under the publish lock and rolls back on denial', async ({ mock }) => {
  const { query, release } = mockPublishTransaction(mock);

  await assert.rejects(database.publishPackage(body, dist, 'another-publisher'), { status: 403 });

  const statements = query.mock.calls.map(call => call.arguments[0].trim());
  assert.equal(statements.length, 4);
  assert.equal(statements[0], 'BEGIN');
  assert.match(statements[1], /^SELECT pg_advisory_xact_lock/);
  assert.match(statements[2], /^SELECT publisher_id/);
  assert.equal(statements[3], 'ROLLBACK');
  assert.deepEqual(query.mock.calls[1].arguments[1], [body.name]);
  assert.deepEqual(query.mock.calls[2].arguments[1], [body.name]);
  assert.equal(release.mock.callCount(), 1);
});

test('reports a duplicate publish without replacing the existing version', async ({ mock }) => {
  const { query, release } = mockPublishTransaction(mock);

  assert.equal(await database.publishPackage(body, dist, 'owner'), undefined);

  const insert = query.mock.calls[3];
  assert.match(insert.arguments[0], /ON CONFLICT \(name, version\) DO NOTHING/);
  assert.deepEqual(insert.arguments[1]?.slice(0, 2), [body.name, body.version]);
  assert.equal(query.mock.calls[4].arguments[0], 'COMMIT');
  assert.equal(release.mock.callCount(), 1);
});

test('resolves latest to the highest stable version by semver', async ({ mock }) => {
  const stable = {
    version: '1.10.0',
    publishedAt: new Date('2026-01-01'),
    publisherId: 'owner'
  };
  const releases = [
    {
      ...stable,
      version: '1.9.0',
      publishedAt: new Date('2026-02-01')
    },
    stable,
    {
      ...stable,
      version: '2.0.0-rc.1',
      publishedAt: new Date('2026-03-01')
    }
  ];
  const query = mock.method(database.pool, 'query', async (_sql: string, params: string[]) => ({
    rows: params.length === 1 ? releases : [stable]
  }));

  assert.deepEqual(await database.getVersion(body.name, 'latest'), stable);
  assert.deepEqual(query.mock.calls.map(call => call.arguments[1]), [
    [body.name],
    [body.name, '1.10.0']
  ]);
});
