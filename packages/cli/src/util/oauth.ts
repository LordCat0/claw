interface OAuthTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

export async function requestOAuthToken(
  endpoint: string,
  parameters: URLSearchParams
) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: parameters
  });
  const body = await response.json() as OAuthTokenResponse;
  const error = body.error_description || body.error;

  if (!response.ok) {
    throw new Error(
      error || `Authentication failed with HTTP ${response.status}.`
    );
  }

  if (!body.access_token || typeof body.expires_in !== 'number') {
    throw new Error('Clerk returned an invalid OAuth token response.');
  }

  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresIn: body.expires_in
  };
}
