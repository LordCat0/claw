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
    if (!getAuth(req).isAuthenticated) {
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
    const existing = await database.getVersion(body.name, body.version);

    if (existing) {
      res.status(409).json({ error: 'This version is already published' });
      return;
    }

    const dist = await s3.uploadPackage(body);
    const metadata = await database.publishPackage(body, dist);

    if (!metadata) {
      res.status(409).json({ error: 'This version is already published' });
      return;
    }

    res.location(`/packages/${body.name}/${body.version}`);
    res.status(201).json(metadata);
  });

export default router;
