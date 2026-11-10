import { Router } from 'express';

const router = Router();

router.route('/{*path}').options((_req, res) => {
  res.sendStatus(204);
});

export default router;
