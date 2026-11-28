import z from 'zod';
import { valid } from 'semver';

const semverSchema = z.string().refine(
  (value) => valid(value) === value.split('+')[0],
  { error: 'Invalid semantic version' }
);
export const packageNameSchema = z.string()
  .regex(/^[a-z0-9][a-z0-9_-]*$/);

const lockedDependencySchema = z.object({
  specifier: z.string(),
  version: semverSchema,
  license: z.string(),
  dependencies: z.optional(z.record(packageNameSchema, z.string())),
  resolved: z.url({ protocol: /^https?$/ }),
  integrity: z.string().regex(/^sha512-[A-Za-z0-9+/]+={0,2}$/)
});

export const lockFileSchema = z.object({
  lockfileVersion: z.literal(1),
  dependencies: z.record(packageNameSchema, lockedDependencySchema)
});

export const packageVersionSchema = z.object({
  version: semverSchema,
  license: z.string(),
  dependencies: z.record(packageNameSchema, z.string()),
  dist: z.object({
    tarball: z.string().startsWith('/packages/'),
    integrity: z.string().regex(/^sha512-[A-Za-z0-9+/]+={0,2}$/)
  })
});

export const packageVersionsSchema = z.object({
  versions: z.array(semverSchema)
});

const baseSchema = z.object({
  name: z.string(),
  version: semverSchema,
  author: z.optional(z.string()),
  license: z.optional(z.string()),
  dependencies: z.optional(z.record(
    packageNameSchema,
    z.string()
  ))
});

export const projectSchema = z.object({
  ...baseSchema.shape,
  type: z.literal('project'),
  sprites: z.record(z.string(), z.string()),
  output: z.optional(z.string())
});

export const packageSchema = z.object({
  ...baseSchema.shape,
  type: z.literal('package'),
  description: z.optional(z.string()),
  repository: z.optional(z.string()),
  homepage: z.optional(z.string()),
  keywords: z.optional(z.array(z.string())),
  main: z.string()
});

export const packageFiles = z.object({
  version: z.string(),
  files: z.record(
    z.string().regex(/^(?:[a-zA-Z0-9_-][a-zA-Z0-9._-]*\/)*[a-zA-Z0-9_-][a-zA-Z0-9._-]*\.claw$/),
    z.string()
  )
});
