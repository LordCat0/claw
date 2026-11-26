import path from 'node:path';

export const packageDirectory = path.resolve('claw_modules');

export function getRegistryURL() {
  const registryURL = process.env.CLAW_REGISTRY_URL;
  if (!registryURL) {
    throw new Error('CLAW_REGISTRY_URL is not set.');
  }

  return registryURL.replace(/\/$/, '');
}

export async function getClerkOAuthConfig() {
  const issuer = process.env.CLAW_CLERK_ISSUER;
  const clientId = process.env.CLAW_CLERK_CLIENT_ID;

  if (issuer && clientId) {
    return {
      issuer,
      clientId
    };
  }

  const response = await fetch(`${getRegistryURL()}/oauth/config`);
  const config = await response.json() as {
    issuer?: string;
    clientId?: string;
  };

  if (!response.ok || !config.issuer || !config.clientId) {
    throw new Error('Could not load the OAuth configuration.');
  }

  return {
    issuer: config.issuer,
    clientId: config.clientId
  };
}
