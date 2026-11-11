import { Router } from 'express';
import database from '../../services/database.ts';
import { packageName, requestedVersion } from '../../validation.ts';

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

export default router;
