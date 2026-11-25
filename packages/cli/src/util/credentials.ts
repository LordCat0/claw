import { homedir } from 'node:os';
import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { requestOAuthToken } from './oauth.ts';

// todo: is there a better place to put this
const credentialsDirectory = join(homedir(), '.claw');
const credentialsFile = join(credentialsDirectory, 'credentials.json');

export interface Credential {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  clientId: string;
  tokenEndpoint: string;
}

async function getCredential() {
  let credentials: unknown;

  try {
    credentials = JSON.parse(await readFile(credentialsFile, 'utf8'));
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      throw new Error('Not signed in. Run claw login.');
    }

    throw error;
  }

  // big
  if (!credentials || typeof credentials !== 'object'
    || !('accessToken' in credentials)
    || typeof credentials.accessToken !== 'string'
    || !('refreshToken' in credentials)
    || typeof credentials.refreshToken !== 'string'
    || !('expiresAt' in credentials)
    || typeof credentials.expiresAt !== 'number'
    || !('clientId' in credentials)
    || typeof credentials.clientId !== 'string'
    || !('tokenEndpoint' in credentials)
    || typeof credentials.tokenEndpoint !== 'string') {
    throw new Error('Invalid credentials. Run claw login again.');
  }

  return credentials as Credential;
}

export async function writeCredential(credentials: Credential) {
  await mkdir(credentialsDirectory, {
    recursive: true,
    mode: 0o700
  });
  await chmod(credentialsDirectory, 0o700);
  await writeFile(
    credentialsFile,
    `${JSON.stringify(credentials, null, 2)}\n`,
    { mode: 0o600 }
  );
  await chmod(credentialsFile, 0o600);
}

export async function getAccessToken() {
  const credentials = await getCredential();

  if (credentials.expiresAt > Date.now() + 60_000) {
    return credentials.accessToken;
  }

  const token = await requestOAuthToken(
    credentials.tokenEndpoint,
    new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: credentials.clientId,
      refresh_token: credentials.refreshToken
    })
  );
  const updatedCredentials = {
    ...credentials,
    accessToken: token.accessToken,
    refreshToken: token.refreshToken || credentials.refreshToken,
    expiresAt: Date.now() + token.expiresIn * 1000
  };

  await writeCredential(updatedCredentials);

  return updatedCredentials.accessToken;
}

export function removeCredential() {
  return rm(credentialsFile, { force: true });
}
