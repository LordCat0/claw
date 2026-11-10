import { Router } from 'express';
import database from '../../services/database.ts';
import s3 from '../../services/s3.ts';
import { env } from '../../config.ts';
import { packageName } from '../../validation.ts';

const router = Router();

router.route('/:name/:version/download').get(async (req, res) => {
  const name = packageName.parse(req.params.name);
  const metadata = await database.getVersion(name, req.params.version);

  if (!metadata) {
    res.status(404).json({ error: 'Package version not found' });
    return;
  }

  const files: Record<string, string> = {};

  for (const file of metadata.files) {
    const body = await s3.downloadFile(file);
    files[file.path] = body.toString('utf8');
  }

  res.attachment(`${name}-${metadata.version}.json`);
  res.json({
    ...metadata,
    files
  });
});

export default router;
