import path from 'node:path';

export const packageDirectory = path.resolve('claw_modules');

export function getRegistryURL() {
  return 'http://localhost:3000';
}

export function getClerkOAuthConfig() {
  return {
    issuer: 'https://pleased-peacock-6861.clerk.accounts.dev',
    clientId: 'AWpMNddEQljgGdd3'
  };
}
