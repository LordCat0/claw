Object.assign(process.env, {
  PORT: '3000',
  DATABASE_URL: 'postgres://unused:unused@localhost/claw_test',
  CLERK_PUBLISHABLE_KEY: 'unused',
  CLERK_SECRET_KEY: 'unused',
  CLERK_OAUTH_CLIENT_ID: 'unused',
  AWS_ENDPOINT_URL: 'http://localhost',
  AWS_ACCESS_KEY_ID: 'unused',
  AWS_SECRET_ACCESS_KEY: 'unused',
  AWS_S3_BUCKET_NAME: 'claw-test',
  AWS_DEFAULT_REGION: 'auto'
});
