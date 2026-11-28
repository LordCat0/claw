import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { buffer } from 'node:stream/consumers';
import { pipeline } from 'node:stream/promises';
import { test } from 'node:test';
import { createGzip, gunzipSync, gzipSync } from 'node:zlib';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { pack } from 'tar-stream';
import './env.ts';
import s3 from '../src/services/s3.ts';

test('round-trips package source through a content-addressed archive', async ({ mock }) => {
  const packageArchive = pack();
  const compressed = pipeline(packageArchive, createGzip(), buffer);
  packageArchive.entry({ name: 'claw.json' }, JSON.stringify({
    name: 'claw-tools',
    version: '1.2.0',
    type: 'package',
    main: 'index.claw'
  }));
  packageArchive.entry({ name: 'index.claw' }, 'var message = "Hello, 世界";');
  packageArchive.entry({ name: 'src/empty.claw' }, '');
  packageArchive.finalize();
  const archive = await compressed;
  const body = await s3.parsePackage(archive);
  const padded = Buffer.concat([gunzipSync(archive), Buffer.alloc(8 * 1024 * 1024)]);
  await assert.rejects(s3.parsePackage(gzipSync(padded)), { status: 400 });
  const send = mock.method(s3.client, 'send', async (_command: PutObjectCommand | GetObjectCommand) => ({}));

  const dist = await s3.uploadPackage(body, archive);
  const [put] = send.mock.calls[0].arguments;
  assert.ok(put instanceof PutObjectCommand);
  assert.equal(put.input.Body, archive);
  const digest = createHash('sha512').update(archive).digest();
  const key = `claw/packages/${digest.toString('hex')}.tgz`;

  assert.equal(put.input.Bucket, 'claw-test');
  assert.equal(put.input.Key, key);
  assert.equal(put.input.ContentType, 'application/gzip');
  assert.deepEqual(dist, {
    tarball: '/packages/claw-tools/1.2.0/download',
    integrity: `sha512-${digest.toString('base64')}`,
    size: archive.length
  });

  send.mock.mockImplementation(async () => ({ Body: Readable.from([archive]) }));
  assert.deepEqual(await s3.getFileNames(dist), Object.keys(body.files));

  assert.equal(send.mock.callCount(), 2);
  const [get] = send.mock.calls[1].arguments;
  assert.ok(get instanceof GetObjectCommand);
  assert.deepEqual(get.input, {
    Bucket: put.input.Bucket,
    Key: key
  });
});

test('rejects a corrupt archive when reading package file names', async ({ mock }) => {
  const archive = Buffer.from('invalid archive');
  const digest = createHash('sha512').update(archive).digest('base64');
  mock.method(s3.client, 'send', async () => ({ Body: Readable.from([archive]) }));

  await assert.rejects(s3.getFileNames({
    tarball: '/packages/claw-tools/1.2.0/download',
    integrity: `sha512-${digest}`,
    size: archive.length
  }), { code: 'Z_DATA_ERROR' });
});
