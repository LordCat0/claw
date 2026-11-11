import { Router } from 'express';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import database from '../../services/database.ts';
import s3 from '../../services/s3.ts';
import { packageName, requestedVersion } from '../../validation.ts';

const router = Router();

router.route('/:name/:version/download').get(async (req, res) => {
  const name = packageName.parse(req.params.name);
  const version = requestedVersion.parse(req.params.version);
  const metadata = await database.getVersion(name, version);

  if (!metadata) {
    res.status(404).json({ error: 'Package version not found' });
    return;
  }

  res.set({
    'Cache-Control': version === 'latest'
      ? 'public, max-age=60'
      : 'public, max-age=31536000, immutable',
    'ETag': `"${metadata.dist.integrity}"`
  });

  if (req.fresh) {
    res.status(304).end();
    return;
  }

  const archive = req.method === 'HEAD'
    ? undefined
    : await s3.downloadPackage(metadata.dist);

  res.attachment(`${name}-${metadata.version}.tgz`);
  res.set({
    'Content-Type': 'application/gzip',
    'Content-Length': String(metadata.dist.size)
  });
  if (!archive) {
    res.end();
    return;
  }

  await pipeline(archive.Body as Readable, res);
});

export default router;
