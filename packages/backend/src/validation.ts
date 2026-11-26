import { valid, validRange } from 'semver';
import { z } from 'zod';

const text = z.string().regex(/^[^\u0000]*$/u, 'Null bytes are not allowed');

export const packageName = z.string().min(1).max(64)
  .regex(/^[a-z0-9][a-z0-9_-]*$/, 'Use a lowercase package name');

export const userId = z.string().min(1).max(128);

const clawFilePath = z.string().max(160).regex(
  /^(?:[a-zA-Z0-9_-][a-zA-Z0-9._-]*\/)*[a-zA-Z0-9_-][a-zA-Z0-9._-]*\.claw$/,
  'Use a relative .claw file path'
);
export const packageFilePath = text.min(1).max(160).refine(
  path => !path.startsWith('/') && !path.includes('\\')
    && path.split('/').every(part => part && part !== '.' && part !== '..'),
  'Use a relative package file path'
);
const binaryContent = z.base64();

export const packageVersion = z.string().max(32).refine(
  value => valid(value) === value.split('+')[0],
  'Use a semantic version such as 1.0.0'
);

export const requestedVersion = z.union([
  z.literal('latest'),
  z.string().max(200).refine(
    value => validRange(value) !== null,
    'Use a semantic version range'
  )
]);

const integerQuery = z.string().regex(/^\d+$/, 'Use a decimal integer')
  .transform(Number);

const link = z.union([
  z.literal(''),
  text.trim().max(2000).pipe(z.url({ protocol: /^https?$/ }))
]).default('');

const publishManifest = z.object({
  name: packageName,
  version: packageVersion,
  type: z.literal('package'),
  description: text.trim().max(500).default(''),
  main: clawFilePath.default('index.claw'),
  license: text.trim().max(100).default(''),
  repository: link,
  homepage: link,
  keywords: z.array(text.trim().min(1).max(64)).max(20).default([]),
  dependencies: z.record(
    packageName,
    z.string().trim().min(1).max(200).refine(
      value => validRange(value) !== null,
      'Use a semantic version range'
    )
  ).refine(
    dependencies => Object.keys(dependencies).length <= 100,
    'Include at most 100 dependencies'
  ).default({})
});

const publishedFiles = z.record(packageFilePath, text).refine(
  files => Object.keys(files).length > 0
    && Object.keys(files).length <= 100,
  'Include between 1 and 100 package files'
).refine(files => Object.hasOwn(files, 'claw.json'), {
  message: 'claw.json must be included in files'
});

export const publishedPackage = publishManifest.extend({
  files: publishedFiles
}).refine(body => Object.hasOwn(body.files, body.main), {
  message: 'The main file must be included in files',
  path: ['main']
}).refine(body => !Object.hasOwn(body.dependencies, body.name), {
  message: 'A package cannot depend on itself',
  path: ['dependencies']
}).superRefine((body, context) => {
  for (const [path, content] of Object.entries(body.files)) {
    if (path === 'claw.json' || path.endsWith('.claw')) {
      continue;
    }

    if (!binaryContent.safeParse(content).success) {
      context.addIssue({
        code: 'custom',
        message: 'Files must use base64 encoding',
        path: ['files', path]
      });
    }
  }
});

export const pageQuery = z.object({
  limit: integerQuery.pipe(z.number().int().min(1).max(100)).default(20),
  offset: integerQuery.pipe(z.number().int().min(0).max(10_000)).default(0)
});

export const listQuery = pageQuery.extend({
  q: text.trim().max(64).default(''),
  sort: z.enum(['relevance', 'name', 'recent']).default('relevance')
});

export type PublishedPackage = z.infer<typeof publishedPackage>;
