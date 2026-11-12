import { Button } from '@base-ui/react/button';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ChevronRight, FileCode, Folder } from 'lucide-preact';
import { useMemo, useState } from 'preact/hooks';
import { env } from '../../config';
import type { PackageFilesResponse } from '../../types/package';
import * as packageStyles from '../../pages/package.css';
import * as styles from './package-code.css';

interface PackageCodeProps {
  name: string;
  version: string;
}

export default function PackageCode(props: PackageCodeProps) {
  const [path, setPath] = useState('');
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['package-files', props.name, props.version],
    queryFn: async ({ signal }): Promise<PackageFilesResponse> => {
      const response = await fetch(
        `${env.apiUrl}/packages/${encodeURIComponent(props.name)}`
          + `/${encodeURIComponent(props.version)}/files`,
        { signal }
      );

      if (!response.ok) {
        throw new Error(`GET ${response.url} failed (${response.status})`);
      }

      return response.json();
    }
  });
  const source = data && Object.hasOwn(data.files, path) ? data.files[path] : undefined;
  const entries = useMemo(() => {
    const children: {
      name: string;
      path: string;
      isFolder: boolean;
    }[] = [];
    const prefix = path ? `${path}/` : '';

    for (const file of Object.keys(data?.files || {})) {
      if (!file.startsWith(prefix)) {
        continue;
      }

      const parts = file.slice(prefix.length).split('/');
      const name = parts[0];

      if (children.some(child => child.name === name)) {
        continue;
      }

      children.push({
        name,
        path: `${prefix}${name}`,
        isFolder: parts.length > 1
      });
    }

    return children.sort((left, right) =>
      Number(right.isFolder) - Number(left.isFolder) || left.name.localeCompare(right.name)
    );
  }, [data, path]);
  const lines = useMemo(() => source?.split(/\r\n|\r|\n/) || [], [source]);

  return (
    <section aria-label="Package code">
      {isPending && (
        <p className={packageStyles.message} role="status">Loading files…</p>
      )}
      {isError && (
        <div className={packageStyles.message} role="alert">
          <p>Could not load package files.</p>
          <Button className={packageStyles.button} onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      )}
      {data && (
        <div className={styles.browser}>
          <header className={styles.toolbar}>
            <Button
              className={styles.back}
              disabled={!path}
              onClick={() => setPath(path.split('/').slice(0, -1).join('/'))}
              aria-label="Back to parent folder"
            >
              <ArrowLeft size={16} aria-hidden="true" /> Back
            </Button>
            <h2 className={styles.path} aria-live="polite">
              /{props.name}/{path}{path && source === undefined && '/'}
            </h2>
          </header>
          {source === undefined && (
            <ul className={styles.list} aria-label="Files and folders">
              {entries.map(entry => (
                <li key={entry.path}>
                  <Button className={styles.entry} onClick={() => setPath(entry.path)}>
                    {entry.isFolder && (
                      <Folder size={18} className={styles.folder} aria-hidden="true" />
                    )}
                    {!entry.isFolder && <FileCode size={18} aria-hidden="true" />}
                    <span className={styles.name}>
                      {entry.name}{entry.isFolder && '/'}
                    </span>
                    <ChevronRight size={15} aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {source === '' && <p className={styles.empty}>This file is empty.</p>}
          {source !== undefined && source !== '' && (
            <div className={styles.source} tabIndex={0} aria-label={`${path} contents`}>
              <pre className={styles.lineNumbers} aria-hidden="true">
                {lines.map((_, index) => index + 1).join('\n')}
              </pre>
              <pre className={styles.code}><code>{source}</code></pre>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
