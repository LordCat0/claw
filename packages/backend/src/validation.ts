import { valid } from 'semver';
import { z } from 'zod';

const text = z.string().regex(/^[^\u0000]*$/u, 'Null bytes are not allowed');

export const packageName = z.string().min(1).max(64)
  .regex(/^[a-z0-9][a-z0-9_-]*$/, 'Use a lowercase package name');

const filePath = z.string().max(160).regex(
  /^(?:[a-zA-Z0-9_-][a-zA-Z0-9._-]*\/)*[a-zA-Z0-9_-][a-zA-Z0-9._-]*\.claw$/,
  'Use a relative .claw file path'
);

export const packageVersion = z.string().max(32).refine(
  value => valid(value) === value.split('+')[0],
  'Use a semantic version such as 1.0.0'
);

export const requestedVersion = z.union([z.literal('latest'), packageVersion]);

const integerQuery = z.string().regex(/^\d+$/, 'Use a decimal integer')
  .transform(Number);

export const publishBody = z.object({
  name: packageName,
  version: packageVersion,
  description: text.trim().max(500).default(''),
  main: filePath.default('index.claw'),
  files: z.record(filePath, text).refine(
    files => Object.keys(files).length > 0
      && Object.keys(files).length <= 100,
    'Include between 1 and 100 .claw files'
  )
}).refine(body => Object.hasOwn(body.files, body.main), {
  message: 'The main file must be included in files',
  path: ['main']
});

export const listQuery = z.object({
  q: text.trim().max(64).default(''),
  sort: z.enum(['relevance', 'name', 'recent']).default('relevance'),
  limit: integerQuery.pipe(z.number().int().min(1).max(100)).default(20),
  offset: integerQuery.pipe(z.number().int().min(0).max(10_000)).default(0)
});

export type PublishBody = z.infer<typeof publishBody>;
