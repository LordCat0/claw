import { Router } from 'express';
import { packageName } from '../../validation.ts';
import database from '../../services/database.ts';
import s3 from '../../services/s3.ts';

const router = Router();

router.route('/:name@:version{/*file}').get<{
  name: string;
  version: string;
  file?: string[];
}>(async (req, res) => {
  const name = packageName.parse(req.params.name);
  const metadata = await database.getVersion(name, req.params.version);

  if (!metadata) {
    res.status(404).json({ error: 'Package version not found' });
    return;
  }

  const path = req.params.file?.join('/') || metadata.main;
  const file = metadata.files.find(file => file.path === path);

  if (!file) {
    res.status(404).json({ error: 'File not found' });
    return;
  }

  const body = await s3.downloadFile(file);
  const cache = req.params.version === 'latest'
    ? 'public, max-age=60'
    : 'public, max-age=31536000, immutable';

  res.set({
    'Cache-Control': cache,
    'Content-Type': 'text/plain; charset=utf-8',
    'ETag': `"${file.sha256}"`
  });
  res.send(body);
});

export default router;
