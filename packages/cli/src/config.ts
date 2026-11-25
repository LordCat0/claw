import path from 'node:path';

export const packageDirectory = path.resolve('claw_modules');
export const backendURL = (
  process.env.CLAW_REGISTRY_URL || 'http://localhost:3000'
).replace(/\/$/, '');

export const clerkOAuth = {
  issuer: process.env.CLAW_CLERK_ISSUER!,
  clientId: process.env.CLAW_CLERK_CLIENT_ID!
};
