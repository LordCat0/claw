import { createHash, timingSafeEqual } from 'node:crypto';
import { json, Router } from 'express';
import database from '../../services/database.ts';
import s3 from '../../services/s3.ts';
import { env } from '../../config.ts';
import { listQuery, publishBody } from '../../validation.ts';

const router = Router();
const tokenHash = createHash('sha256')
  .update(`Bearer ${env.PUBLISH_TOKEN}`).digest();

router.route('/')
  .get(async (req, res) => {
    const query = listQuery.parse(req.query);
    const packages = await database.listPackages(query);

    res.json({
      packages,
      limit: query.limit,
      offset: query.offset
    });
  })
  .post((req, res, next) => {
    const suppliedHash = createHash('sha256')
      .update(req.get('authorization') || '').digest();

    if (!timingSafeEqual(tokenHash, suppliedHash)) {
      res.set('WWW-Authenticate', 'Bearer');
      res.status(401).json({ error: 'Invalid publishing token' });
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

    const files = await s3.uploadFiles(body.files);
    const metadata = await database.publishPackage(body, files);

    if (!metadata) {
      res.status(409).json({ error: 'This version is already published' });
      return;
    }

    res.location(`/packages/${body.name}/${body.version}`);
    res.status(201).json(metadata);
  });

export default router;
