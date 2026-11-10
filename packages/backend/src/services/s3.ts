import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { createHash } from 'node:crypto';
import { env } from '../config.ts';
import type { PackageFile } from '../types.ts';

class S3Manager {
  client: S3Client;

  constructor() {
    this.client = new S3Client({
      endpoint: env.AWS_ENDPOINT_URL,
      region: env.AWS_DEFAULT_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY
      }
    });
  }

  async uploadFiles(files: Record<string, string>): Promise<PackageFile[]> {
    const metadata: PackageFile[] = [];

    for (const [path, source] of Object.entries(files)) {
      const body = Buffer.from(source, 'utf8');
      const sha256 = createHash('sha256').update(body).digest('hex');

      await this.client.send(new PutObjectCommand({
        Bucket: env.AWS_S3_BUCKET_NAME,
        Key: `claw/${sha256}.claw`,
        Body: body,
        ContentType: 'text/plain; charset=utf-8'
      }));

      metadata.push({
        path,
        size: body.length,
        sha256
      });
    }

    return metadata;
  }

  async downloadFile(file: PackageFile): Promise<Buffer> {
    const result = await this.client.send(new GetObjectCommand({
      Bucket: env.AWS_S3_BUCKET_NAME,
      Key: `claw/${file.sha256}.claw`
    }));

    return Buffer.from(await result.Body!.transformToByteArray());
  }


  close() {
    this.client.destroy();
  }
}

export default new S3Manager();
