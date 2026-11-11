import { z } from 'zod';

const config = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.url(),
  CLERK_PUBLISHABLE_KEY: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1),
  AWS_ENDPOINT_URL: z.url(),
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
  AWS_S3_BUCKET_NAME: z.string().min(1),
  AWS_DEFAULT_REGION: z.string().min(1).default('auto')
}).safeParse(process.env);

if (!config.success) {
  const fields = config.error.issues.map(issue => issue.path.join('.'));
  console.error(`Invalid environment variables: ${fields.join(', ')}`);
  process.exit(1);
}

export const env = config.data;
