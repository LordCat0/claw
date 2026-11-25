import { removeCredential } from '../util/credentials.ts';

export default async function logout() {
  await removeCredential();
  console.log('Logged out.');
}
