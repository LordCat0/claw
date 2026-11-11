import { Button } from '@base-ui/react/button';
import { useQuery } from '@tanstack/react-query';
import { route } from 'preact-router';
import Header from '../components/header/header';
import PackageListItem from '../components/package-list-item/package-list-item';
import { env } from '../config';
import type { SearchResponse } from '../types/search';
import * as styles from './search.css';

interface SearchProps {
  url?: string;
};

const pageSize = 20;

function searchUrl(query: string, sort: string, page: number) {
  const params = new URLSearchParams({
    q: query,
    sort,
    page: String(page)
  });

  return `/search?${params}`;
}

export default function Search(props: SearchProps) {
  const params = new URLSearchParams((props.url || '').split('?')[1]);
  const query = (params.get('q') || '').trim().slice(0, 64);
  const requestedSort = params.get('sort') || '';
  const sort = ['name', 'recent'].includes(requestedSort) ? requestedSort : 'relevance';
  const page = Math.min(501, Math.max(1, Math.floor(Number(params.get('page'))) || 1));

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['packages', query, sort, page],
    queryFn: async ({ signal }): Promise<SearchResponse> => {
      const search = new URLSearchParams({
        q: query,
        sort,
        limit: String(pageSize),
        offset: String((page - 1) * pageSize)
      });
      const response = await fetch(`${env.apiUrl}/search?${search}`, { signal });

      if (!response.ok) {
        throw new Error('Could not load packages');
      }

      return response.json();
    }
  });

  return (
    <div>
      <Header query={query} />
      <main className={styles.main}>
        <div className={styles.toolbar}>
          <div>
            <h1 className={styles.heading}>
              {data && (
                <>
                  {data.total.toLocaleString()}{' '}
                  {data.total === 1 ? 'package' : 'packages'} found
                </>
              )}
              {!data && 'Search packages'}
            </h1>
            {query && (
              <p className={styles.query}>Results for “{query}”</p>
            )}
          </div>
          <label className={styles.sort}>
            Sort by
            <select
              className={styles.select}
              value={sort}
              onChange={event => route(searchUrl(query, event.currentTarget.value, 1))}
            >
              <option value="relevance">Relevance</option>
              <option value="recent">Recently published</option>
              <option value="name">Name</option>
            </select>
          </label>
        </div>

        {isPending && (
          <p className={styles.message} role="status">Searching packages…</p>
        )}

        {isError && (
          <div className={styles.message} role="alert">
            <p>Could not load packages. Please try again.</p>
            <Button className={styles.button} onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        )}

        {data && data.packages.length === 0 && (
          <div className={styles.message} role="status">
            <p>No packages found.</p>
            <p>Try a different search or a broader package name.</p>
          </div>
        )}

        {data && data.packages.length > 0 && (
          <ul className={styles.results} aria-label="Packages">
            {data.packages.map((pkg => (
              <PackageListItem key={pkg.name} pkg={pkg} />
            )))}
          </ul>
        )}

        {data && data.total > pageSize && (
          <nav className={styles.pagination} aria-label="Search results pages">
            {page > 1 && (
              <a className={styles.button} href={searchUrl(query, sort, page - 1)}>
                Previous
              </a>
            )}
            <span>Page {page}</span>
            {page * pageSize < data.total && page < 501 && (
              <a className={styles.button} href={searchUrl(query, sort, page + 1)}>
                Next
              </a>
            )}
          </nav>
        )}
      </main>
    </div>
  );
}
