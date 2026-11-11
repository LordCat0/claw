import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { createHash } from 'node:crypto';
import type { Readable } from 'node:stream';
import { buffer } from 'node:stream/consumers';
import { pipeline } from 'node:stream/promises';
import { createGunzip, createGzip } from 'node:zlib';
import { extract, pack } from 'tar-stream';
import { env } from '../config.ts';
import type { PackageDistribution } from '../types.ts';
import type { PublishBody } from '../validation.ts';

class S3Manager {
  client: S3Client;

  constructor() {
    this.client = new S3Client({
      endpoint: env.AWS_ENDPOINT_URL,
      region: env.AWS_DEFAULT_REGION,
      forcePathStyle: true,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY
      }
    });
  }

  async uploadPackage(body: PublishBody): Promise<PackageDistribution> {
    const archive = pack();
    const compressed = pipeline(archive, createGzip(), buffer);

    for (const [path, source] of Object.entries(body.files)) {
      archive.entry({
        name: path,
        mtime: new Date(0)
      }, source);
    }

    archive.finalize();

    const content = await compressed;
    const digest = createHash('sha512').update(content).digest();

    await this.client.send(new PutObjectCommand({
      Bucket: env.AWS_S3_BUCKET_NAME,
      Key: `claw/packages/${digest.toString('hex')}.tgz`,
      Body: content,
      ContentType: 'application/gzip'
    }));

    return {
      tarball: `/packages/${body.name}/${body.version}/download`,
      integrity: `sha512-${digest.toString('base64')}`,
      size: content.length
    };
  }

  async downloadPackage(dist: PackageDistribution) {
    const digest = Buffer.from(dist.integrity.slice(7), 'base64');

    return this.client.send(new GetObjectCommand({
      Bucket: env.AWS_S3_BUCKET_NAME,
      Key: `claw/packages/${digest.toString('hex')}.tgz`
    }));
  }

  async getFiles(dist: PackageDistribution): Promise<Record<string, string>> {
    const object = await this.downloadPackage(dist);
    const archive = extract();
    const files: Record<string, string> = {};

    archive.on('entry', (header, stream, next) => {
      buffer(stream).then(content => {
        files[header.name] = content.toString('utf8');
        next();
      }, error => archive.destroy(error));
    });

    await pipeline(object.Body as Readable, createGunzip(), archive);

    return files;
  }

  close() {
    this.client.destroy();
  }
}

export default new S3Manager();
