import { Router } from 'express';
import database from '../../services/database.ts';
import { packageName } from '../../validation.ts';

const router = Router();

router.route('/:name').get(async (req, res) => {
  const name = packageName.parse(req.params.name);
  const metadata = await database.getVersions(name);

  if (metadata.versions.length === 0) {
    res.status(404).json({ error: 'Package not found' });
    return;
  }

  res.json(metadata);
});

export default router;
