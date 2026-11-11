import express from 'express';
import cors from 'cors';
import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import cdnRouter from './routes/cdn/download.ts';
import discoveryRouter from './routes/discovery.ts';
import healthRouter from './routes/health/check.ts';
import collectionRouter from './routes/packages/collection.ts';
import packageDownloadRouter from './routes/packages/download.ts';
import metadataRouter from './routes/packages/metadata.ts';
import versionRouter from './routes/packages/version.ts';

const app = express();

app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store'
  });
  next();
});

app.use(cors({
  methods: ['GET', 'HEAD', 'POST', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type']
}));
app.use('/health', healthRouter);
app.use(discoveryRouter);
app.use(
  '/packages',
  collectionRouter,
  metadataRouter,
  versionRouter,
  packageDownloadRouter
);
app.use('/cdn', cdnRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const handleError: ErrorRequestHandler = (
  error: unknown,
  _req,
  res,
  _next
) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: 'Invalid request',
      issues: error.issues
    });
    return;
  }

  if (error instanceof Error && 'status' in error
    && typeof error.status === 'number'
    && error.status >= 400 && error.status < 500) {
    res.status(error.status).json({ error: 'Invalid request' });
    return;
  }

  console.error(error);
  res.status(500).json({ error: 'Internal server error' });
};

app.use(handleError);

export default app;
