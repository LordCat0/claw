import { clerkMiddleware, getAuth } from '@clerk/express';
import { json, Router } from 'express';
import database from '../../services/database.ts';
import s3 from '../../services/s3.ts';
import { publishBody } from '../../validation.ts';
import { searchPackages } from '../discovery.ts';

const router = Router();

router.route('/')
  .get(searchPackages)
  .post(clerkMiddleware(), (req, res, next) => {
    const auth = getAuth(req);

    if (!auth.isAuthenticated || !auth.userId) {
      res.set('WWW-Authenticate', 'Bearer');
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    next();
  }, json({ limit: '5mb' }), async (req, res) => {
    if (!req.is('application/json')) {
      res.status(415).json({ error: 'Use application/json' });
      return;
    }

    const body = publishBody.parse(req.body);
    const userId = getAuth(req).userId!;
    const ownerId = await database.getOwnerId(body.name);

    if (ownerId !== undefined && ownerId !== userId) {
      res.status(403).json({ error: 'Only the package owner can publish versions' });
      return;
    }

    const existing = await database.getVersion(body.name, body.version);

    if (existing) {
      res.status(409).json({ error: 'This version is already published' });
      return;
    }

    const dist = await s3.uploadPackage(body);
    const metadata = await database.publishPackage(body, dist, userId);

    if (!metadata) {
      res.status(409).json({ error: 'This version is already published' });
      return;
    }

    res.location(`/packages/${body.name}/${body.version}`);
    res.status(201).json(metadata);
  });

export default router;
