import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { spawn } from 'node:child_process';
import chalk from 'chalk';
import { getClerkOAuthConfig } from '../config.ts';
import { writeCredential } from '../util/credentials.ts';
import { requestOAuthToken } from '../util/oauth.ts';

function openBrowser(url: string, onError: (error: Error) => void) {
  let command = 'xdg-open';
  let args = [url];

  if (process.platform === 'darwin') {
    command = 'open';
  }

  if (process.platform === 'win32') {
    command = 'cmd';
    args = ['/c', 'start', '', url];
  }

  const browser = spawn(command, args, {
    detached: true,
    stdio: 'ignore'
  });

  browser.once('error', onError);
  browser.unref();
}

export default async function login() {
  const clerkOAuth = await getClerkOAuthConfig();
  const authorizationURL = new URL('/oauth/authorize', clerkOAuth.issuer);
  const tokenEndpoint = new URL('/oauth/token', clerkOAuth.issuer).toString();
  const state = randomBytes(32).toString('base64url');
  const codeVerifier = randomBytes(32).toString('base64url');
  const codeChallenge = createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  let rejectLogin: (error: Error) => void = () => {};
  let timeout: NodeJS.Timeout;

  // create a temporary server to recieve the tokens.
  const server = createServer();
  const code = new Promise<string>((resolve, reject) => {
    rejectLogin = reject;

    server.on('request', (request, response) => {
      const url = new URL(request.url || '/', 'http://127.0.0.1');
      const loginCode = url.searchParams.get('code');
      const loginError = url.searchParams.get('error_description')
        || url.searchParams.get('error');

      if (url.pathname !== '/callback' || url.searchParams.get('state') !== state
        || (!loginCode && !loginError)) {
        response.writeHead(400).end('Invalid login response');
        return;
      }

      response.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store'
      });
      response.end(
        '<!doctype html><title>Claw login</title>'
        + '<p>Login complete, you can close this window.</p>'
        + '<script>window.close()</script>',
        () => {
          if (loginError) {
            reject(new Error(loginError));
            return;
          }

          resolve(loginCode!);
        }
      );
    });
    server.once('error', reject);
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(0, '127.0.0.1', resolve);
    server.once('error', reject);
  });

  const address = server.address() as AddressInfo;
  const redirectURI = `http://127.0.0.1:${address.port}/callback`;
  authorizationURL.searchParams.set('response_type', 'code');
  authorizationURL.searchParams.set('client_id', clerkOAuth.clientId);
  authorizationURL.searchParams.set('redirect_uri', redirectURI);
  authorizationURL.searchParams.set('scope', 'profile offline_access');
  authorizationURL.searchParams.set('state', state);
  authorizationURL.searchParams.set('code_challenge', codeChallenge);
  authorizationURL.searchParams.set('code_challenge_method', 'S256');

  timeout = setTimeout(() => {
    rejectLogin(new Error('Login timed out.'));
  }, 10 * 60 * 1000);
  openBrowser(authorizationURL.toString(), rejectLogin);
  console.log(chalk.yellow('Complete the login in your browser.'));

  try {
    const loginCode = await code;
    const token = await requestOAuthToken(
      tokenEndpoint,
      new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clerkOAuth.clientId,
        redirect_uri: redirectURI,
        code: loginCode,
        code_verifier: codeVerifier
      })
    );

    if (!token.refreshToken) {
      throw new Error('Clerk did not return a refresh token.');
    }

    await writeCredential({
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      expiresAt: Date.now() + token.expiresIn * 1000,
      clientId: clerkOAuth.clientId,
      tokenEndpoint
    });
    console.log(chalk.green('Logged in.'));
  } finally {
    clearTimeout(timeout);
    server.close();
  }
}
