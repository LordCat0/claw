import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { test } from 'node:test';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import './env.ts';
import s3 from '../src/services/s3.ts';
import { publishBody } from '../src/validation.ts';

test('round-trips package source through a content-addressed archive', async ({ mock }) => {
  const body = publishBody.parse({
    name: 'claw-tools',
    version: '1.2.0',
    files: {
      'index.claw': 'var message = "Hello, 世界";',
      'src/empty.claw': ''
    }
  });
  const send = mock.method(s3.client, 'send', async (_command: PutObjectCommand | GetObjectCommand) => ({}));

  const dist = await s3.uploadPackage(body);
  const [put] = send.mock.calls[0].arguments;
  assert.ok(put instanceof PutObjectCommand);
  const archive = put.input.Body;
  assert.ok(Buffer.isBuffer(archive));
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
  assert.deepEqual(await s3.getFiles(dist), body.files);

  assert.equal(send.mock.callCount(), 2);
  const [get] = send.mock.calls[1].arguments;
  assert.ok(get instanceof GetObjectCommand);
  assert.deepEqual(get.input, {
    Bucket: put.input.Bucket,
    Key: key
  });
});

test('rejects a corrupt archive when reading package files', async ({ mock }) => {
  const archive = Buffer.from('invalid archive');
  const digest = createHash('sha512').update(archive).digest('base64');
  mock.method(s3.client, 'send', async () => ({ Body: Readable.from([archive]) }));

  await assert.rejects(s3.getFiles({
    tarball: '/packages/claw-tools/1.2.0/download',
    integrity: `sha512-${digest}`,
    size: archive.length
  }), { code: 'Z_DATA_ERROR' });
});
