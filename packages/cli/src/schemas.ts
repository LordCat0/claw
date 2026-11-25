import z from 'zod';
import semverRegex from 'semver-regex';

const semverSchema = z.string().refine(
  (value) => semverRegex().exec(value)?.[0] === value,
  { error: "Invalid semantic version" }
);

const baseSchema = z.object({
  name: z.string(),
  version: semverSchema,
  author: z.optional(z.string()),
  license: z.optional(z.string()),
  dependencies: z.optional(z.record(
    z.string(),
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