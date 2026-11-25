import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join, posix } from 'node:path';
import chalk from 'chalk';
import { backendURL } from '../config.ts';
import { getClawFile } from '../util/claw-file.ts';
import { getAccessToken } from '../util/credentials.ts';

const ignoredDirectories = ['.git', 'claw_modules', 'node_modules'];

async function readClawFiles(directory = '.', prefix = '') {
  const files: Record<string, string> = {};

  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.includes(entry.name)) {
      continue;
    }

    const path = join(directory, entry.name);
    const name = posix.join(prefix, entry.name);

    if (entry.isDirectory()) {
      Object.assign(files, await readClawFiles(path, name));
    } else if (entry.isFile() && entry.name.endsWith('.claw')) {
      files[name] = await readFile(path, 'utf8');
    }
  }

  return files;
}

export default async function publish() {
  const clawFile = getClawFile();

  if (clawFile.type !== 'package') {
    throw new Error('Only packages can be published.');
  }

  const token = await getAccessToken();
  const response = await fetch(`${backendURL}/packages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      ...clawFile,
      description: clawFile.description || '',
      readme: existsSync('README.md')
        ? await readFile('README.md', 'utf8')
        : '',
      license: clawFile.license || '',
      repository: clawFile.repository || '',
      homepage: clawFile.homepage || '',
      keywords: clawFile.keywords || [],
      dependencies: clawFile.dependencies || {},
      files: await readClawFiles()
    })
  });
  const body = await response.json() as { error?: string };

  if (!response.ok) {
    throw new Error(body.error || `Publish failed with HTTP ${response.status}.`);
  }

  console.log(chalk.green(
    `Published ${clawFile.name}@${clawFile.version}.`
  ));
}
