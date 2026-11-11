import { clerkClient } from '@clerk/express';
import { Router } from 'express';
import database from '../../services/database.ts';
import { packageName, pageQuery } from '../../validation.ts';

const router = Router();

router.route('/:name').get(async (req, res) => {
  const name = packageName.parse(req.params.name);
  const metadata = await database.getVersions(name);

  if (metadata.versions.length === 0) {
    res.status(404).json({ error: 'Package not found' });
    return;
  }

  const release = await database.getVersion(name, metadata.latest!);
  const [downloads, dependents, ownerId] = await Promise.all([
    database.getDownloads([name]),
    database.getDependents(name, 1, 0),
    database.getOwnerId(name)
  ]);
  const collaborators = [];

  if (ownerId) {
    const users = await clerkClient.users.getUserList({
      userId: [ownerId],
      limit: 1
    });

    for (const user of users.data) {
      collaborators.push({
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        imageUrl: user.imageUrl
      });
    }
  }

  res.json({
    ...metadata,
    ...release,
    visibility: 'public',
    dependencyCount: Object.keys(release!.dependencies).length,
    dependentCount: dependents.total,
    collaborators,
    downloads: downloads[name]
  });
});

router.get('/:name/dependents', async (req, res) => {
  const name = packageName.parse(req.params.name);
  const query = pageQuery.parse(req.query);
  const ownerId = await database.getOwnerId(name);

  if (ownerId === undefined) {
    res.status(404).json({ error: 'Package not found' });
    return;
  }

  const result = await database.getDependents(name, query.limit, query.offset);

  res.json({
    ...result,
    ...query
  });
});

export default router;
