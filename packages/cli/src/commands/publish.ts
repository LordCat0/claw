import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { extname, join, matchesGlob, posix } from 'node:path';
import chalk from 'chalk';
import { getRegistryURL } from '../config.ts';
import { getAccessToken } from '../util/credentials.ts';

interface IgnoreRule {
  ignored: boolean;
  patterns: string[];
}

async function readIgnoreRules() {
  if (!existsSync('.clawignore')) {
    return [];
  }

  return (await readFile('.clawignore', 'utf8'))
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .map((line): IgnoreRule => {
      const ignored = !line.startsWith('!');
      const original = ignored ? line : line.slice(1);
      const anchored = original.startsWith('/');
      const pattern = original.replace(/^\//, '').replace(/\/$/, '');
      const patterns = anchored || pattern.includes('/')
        ? [pattern]
        : [pattern, `**/${pattern}`];

      return {
        ignored,
        patterns: [...patterns, ...patterns.map(value => `${value}/**`)]
      };
    });
}

function isIgnored(path: string, rules: IgnoreRule[]) {
  let ignored = false;

  for (const rule of rules) {
    if (rule.patterns.some(pattern => matchesGlob(path, pattern))) {
      ignored = rule.ignored;
    }
  }

  return ignored;
}

async function readPackageFiles(
  rules: IgnoreRule[],
  directory = '.',
  prefix = ''
) {
  const files: Record<string, string> = {};

  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name === 'claw_modules') {
      continue;
    }

    const path = join(directory, entry.name);
    const name = posix.join(prefix, entry.name);

    if (entry.isDirectory()) {
      Object.assign(files, await readPackageFiles(rules, path, name));
    } else if (entry.isFile() && !isIgnored(name, rules)) {
      const encoding = extname(entry.name).toLowerCase() === '.claw'
        ? 'utf8'
        : 'base64';
      files[name] = await readFile(path, encoding);
    }
  }

  return files;
}

export default async function publish() {
  const registryURL = getRegistryURL();
  const files = await readPackageFiles(await readIgnoreRules());
  files['claw.json'] = await readFile('claw.json', 'utf8');

  const token = await getAccessToken();
  const response = await fetch(`${registryURL}/packages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      readme: existsSync('README.md')
        ? await readFile('README.md', 'utf8')
        : '',
      files
    })
  });
  const body = await response.json() as {
    error?: string;
    name: string;
    version: string;
  };

  if (!response.ok) {
    throw new Error(body.error || `Publish failed with HTTP ${response.status}.`);
  }

  console.log(chalk.green(
    `Published ${body.name}@${body.version}.`
  ));
}
