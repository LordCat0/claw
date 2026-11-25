import { clerkClient } from '@clerk/express';
import { Router } from 'express';
import type { UserProfile } from 'shared';
import database from '../../services/database.ts';
import { pageQuery, userId } from '../../validation.ts';

const router = Router();

router.get('/:id', async (req, res) => {
  const id = userId.parse(req.params.id);
  const query = pageQuery.parse(req.query);
  const users = await clerkClient.users.getUserList({
    userId: [id],
    limit: 1
  });
  const user = users.data[0];

  if (!user) {
    res.status(404).json({ error: 'Profile not found' });
    return;
  }

  const packages = await database.getUserPackages(id, query.limit, query.offset);
  const profile: UserProfile = {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    imageUrl: user.imageUrl,
    createdAt: new Date(user.createdAt).toISOString(),
    ...packages
  };

  res.json(profile);
});

export default router;
