import chalk from 'chalk';
import { removeCredential } from '../util/credentials.ts';

export default async function logout() {
  await removeCredential();
  console.log(chalk.green('Logged out.'));
}
