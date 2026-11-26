import { Router } from 'express';
import database from '../../services/database.ts';
import s3 from '../../services/s3.ts';
import { packageFilePath, packageName, requestedVersion } from '../../validation.ts';

const router = Router();

router.route('/:name/:version').get(async (req, res) => {
  const name = packageName.parse(req.params.name);
  const version = requestedVersion.parse(req.params.version);
  const metadata = await database.getVersion(name, version);

  if (!metadata) {
    res.status(404).json({ error: 'Package version not found' });
    return;
  }

  res.json(metadata);
});

router.get('/:name/:version/files', async (req, res) => {
  const name = packageName.parse(req.params.name);
  const version = requestedVersion.parse(req.params.version);
  const metadata = await database.getVersion(name, version);

  if (!metadata) {
    res.status(404).json({ error: 'Package version not found' });
    return;
  }

  res.json({
    name,
    version: metadata.version,
    files: await s3.getFileNames(metadata.dist)
  });
});

router.get('/:name/:version/file', async (req, res) => {
  const name = packageName.parse(req.params.name);
  const version = requestedVersion.parse(req.params.version);
  const path = packageFilePath.parse(req.query.path);
  const metadata = await database.getVersion(name, version);

  if (!metadata) {
    res.status(404).json({ error: 'Package version not found' });
    return;
  }

  const file = await s3.getFile(metadata.dist, path);

  if (!file) {
    res.status(404).json({ error: 'Package file not found' });
    return;
  }

  res.type('text/plain').send(file);
});

export default router;
