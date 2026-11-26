import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { buffer } from 'node:stream/consumers';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import { extract } from 'tar-stream';
import { ZodError } from 'zod';
import { env } from '../config.ts';
import type { PackageDistribution } from 'shared';
import { publishedPackage, type PublishedPackage } from '../validation.ts';

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

  async parsePackage(content: Buffer): Promise<PublishedPackage> {
    const archive = extract();
    const files: Record<string, string> = {};
    let fileCount = 0;
    let totalSize = 0;

    archive.on('entry', (header, stream, next) => {
      fileCount += 1;
      totalSize += header.size;

      if (header.type !== 'file' || fileCount > 100
        || totalSize > 5 * 1024 * 1024) {
        archive.destroy(new Error('Invalid package archive'));
        return;
      }

      buffer(stream).then(file => {
        if (header.name === 'claw.json' || header.name.endsWith('.claw')) {
          files[header.name] = file.toString('utf8');
        } else {
          files[header.name] = file.toString('base64');
        }

        next();
      }, error => archive.destroy(error));
    });

    try {
      await pipeline(Readable.from(content), createGunzip(), archive);
      const manifest = JSON.parse(files['claw.json']) as Record<string, unknown>;

      return publishedPackage.parse({
        ...manifest,
        files
      });
    } catch (error) {
      if (error instanceof ZodError) {
        throw error;
      }

      throw Object.assign(new Error('Invalid package archive'), {
        status: 400,
        cause: error
      });
    }
  }

  async uploadPackage(
    body: PublishedPackage,
    content: Buffer
  ): Promise<PackageDistribution> {
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

  async getFileNames(dist: PackageDistribution): Promise<string[]> {
    const object = await this.downloadPackage(dist);
    const archive = extract();
    const files: string[] = [];

    archive.on('entry', (header, stream, next) => {
      if (header.name === 'claw.json' || header.name.endsWith('.claw')) {
        files.push(header.name);
      }

      stream.on('end', next);
      stream.resume();
    });

    await pipeline(object.Body as Readable, createGunzip(), archive);

    return files;
  }

  async getFile(
    dist: PackageDistribution,
    path: string
  ): Promise<Buffer | undefined> {
    const object = await this.downloadPackage(dist);
    const archive = extract();
    let file: Buffer | undefined;

    archive.on('entry', (header, stream, next) => {
      if (header.name !== path) {
        stream.on('end', next);
        stream.resume();
        return;
      }

      buffer(stream).then(content => {
        file = content;
        next();
      }, error => archive.destroy(error));
    });

    await pipeline(object.Body as Readable, createGunzip(), archive);

    return file;
  }

  close() {
    this.client.destroy();
  }
}

export default new S3Manager();
