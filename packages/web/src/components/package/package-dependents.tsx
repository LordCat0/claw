import { Button } from '@base-ui/react/button';
import { useQuery } from '@tanstack/react-query';
import { Num, T, useGT } from 'gt-react';
import { useState } from 'preact/hooks';
import { env } from '../../config';
import type { PackageDependentsResponse } from 'shared';
import UserLink from '../user-link/user-link';
import * as styles from '../../pages/package.css';

interface PackageDependentsProps {
  name: string;
}

const pageSize = 20;

export default function PackageDependents(props: PackageDependentsProps) {
  const gt = useGT();
  const [page, setPage] = useState(1);
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['package-dependents', props.name, page],
    queryFn: async ({ signal }): Promise<PackageDependentsResponse> => {
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String((page - 1) * pageSize)
      });
      const response = await fetch(
        `${env.apiUrl}/packages/${encodeURIComponent(props.name)}/dependents?${params}`,
        { signal }
      );

      if (!response.ok) {
        throw new Error(`GET ${response.url} failed (${response.status})`);
      }

      return response.json();
    }
  });

  return (
    <section>
      <h2 className={styles.subheading}><T>Dependents</T></h2>
      {isPending && <p className={styles.message} role="status"><T>Loading dependents…</T></p>}
      {isError && (
        <div className={styles.message} role="alert">
          <p><T>Could not load dependents.</T></p>
          <Button className={styles.button} onClick={() => refetch()}><T>Try again</T></Button>
        </div>
      )}
      {data && data.total === 0 && (
        <p className={styles.message}><T>No packages depend on this package yet.</T></p>
      )}
      {data && (
        <ul className={styles.list}>
          {data.packages.map(pkg => (
            <li className={styles.dependent} key={pkg.name}>
              <a className={styles.link} href={`/package/${pkg.name}`}>{pkg.name}</a>
              <code className={styles.message}>{pkg.version}</code>
              <UserLink id={pkg.publisherId} className={styles.link} />
              {pkg.description && <p className={styles.message}>{pkg.description}</p>}
            </li>
          ))}
        </ul>
      )}
      {data && data.total > pageSize && (
        <nav className={styles.pagination} aria-label={gt('Dependent packages pages')}>
          <Button
            className={styles.button}
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            <T>Previous</T>
          </Button>
          <span><T>Page <Num>{page}</Num></T></span>
          <Button
            className={styles.button}
            disabled={page * pageSize >= data.total || page >= 501}
            onClick={() => setPage(page + 1)}
          >
            <T>Next</T>
          </Button>
        </nav>
      )}
    </section>
  );
}
