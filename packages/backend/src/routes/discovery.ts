import { Router } from 'express';
import type { RequestHandler } from 'express';
import database from '../services/database.ts';
import { listQuery } from '../validation.ts';

const router = Router();

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

export default router;
