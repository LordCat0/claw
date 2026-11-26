import { Router } from 'express';
import type { RequestHandler } from 'express';
import { env } from '../config.ts';
import database from '../services/database.ts';
import { listQuery } from '../validation.ts';

const router = Router();
const clerkDomain = Buffer.from(
  env.CLERK_PUBLISHABLE_KEY.replace(/^pk_(?:test|live)_/, ''),
  'base64'
).toString().replace(/\$$/, '');

export const searchPackages: RequestHandler = async (req, res) => {
  const query = listQuery.parse(req.query);
  const result = await database.listPackages(query);

  res.json({
    ...result,
    limit: query.limit,
    offset: query.offset
  });
};

router.get('/search', searchPackages);

router.get('/stats', async (_req, res) => {
  res.json(await database.getStats());
});

router.get('/oauth/config', (_req, res) => {
  res.json({
    issuer: `https://${clerkDomain}`,
    clientId: env.CLERK_OAUTH_CLIENT_ID
  });
});

export default router;
