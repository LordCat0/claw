import { clerkMiddleware, getAuth } from '@clerk/express';
import { raw, Router } from 'express';
import { env } from '../../config.ts';
import database from '../../services/database.ts';
import s3 from '../../services/s3.ts';
import { searchPackages } from '../discovery.ts';

const router = Router();

router.route('/')
  .get(searchPackages)
  .post(clerkMiddleware(), (req, res, next) => {
    const auth = getAuth(req, { acceptsToken: 'oauth_token' });

    if (!auth.isAuthenticated || !auth.userId
      || auth.clientId !== env.CLERK_OAUTH_CLIENT_ID) {
      res.set('WWW-Authenticate', 'Bearer');
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    res.locals.userId = auth.userId;
    next();
  }, raw({ limit: '5mb', type: 'application/gzip' }), async (req, res) => {
    if (!req.is('application/gzip')) {
      res.status(415).json({ error: 'Use application/gzip' });
      return;
    }

    const body = await s3.parsePackage(req.body);
    const userId = res.locals.userId;
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

    const dist = await s3.uploadPackage(body, req.body);
    const metadata = await database.publishPackage(body, dist, userId);

    if (!metadata) {
      res.status(409).json({ error: 'This version is already published' });
      return;
    }

    res.location(`/packages/${body.name}/${body.version}`);
    res.status(201).json(metadata);
  });

export default router;
