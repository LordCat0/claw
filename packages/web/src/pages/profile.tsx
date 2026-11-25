import { Avatar } from '@base-ui/react/avatar';
import { Button } from '@base-ui/react/button';
import { useQuery } from '@tanstack/react-query';
import { Num, Plural, T, useGT, useLocale, Var } from 'gt-react';
import { Package } from 'lucide-preact';
import type { UserProfile } from 'shared';
import Header from '../components/header/header';
import PackageListItem from '../components/package-list-item/package-list-item';
import { env } from '../config';
import * as styles from './profile.css';

interface ProfileProps {
  id?: string;
  url?: string;
}

const pageSize = 20;

export default function Profile(props: ProfileProps) {
  const gt = useGT();
  const locale = useLocale();
  const id = props.id || '';
  const params = new URLSearchParams((props.url || '').split('?')[1]);
  const page = Math.min(501, Math.max(1, Math.floor(Number(params.get('page'))) || 1));
  const { data: profile, isPending, isError, refetch } = useQuery({
    queryKey: ['profile', id, page],
    queryFn: async ({ signal }): Promise<UserProfile | null> => {
      const query = new URLSearchParams({
        limit: String(pageSize),
        offset: String((page - 1) * pageSize)
      });
      const response = await fetch(
        `${env.apiUrl}/users/${encodeURIComponent(id)}?${query}`,
        { signal }
      );

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`GET ${response.url} failed (${response.status})`);
      }

      return response.json();
    }
  });
  const name = profile?.username || profile?.fullName || gt('Unknown');

  return (
    <div>
      <Header query="" />
      <main className={styles.main}>
        {isPending && (
          <p className={styles.message} role="status">
            <T>Loading profile…</T>
          </p>
        )}
        {isError && (
          <div className={styles.message} role="alert">
            <p><T>Could not load this profile. Please try again.</T></p>
            <Button className={styles.button} onClick={() => refetch()}>
              <T>Try again</T>
            </Button>
          </div>
        )}
        {profile === null && (
          <div>
            <T>
              <h1 className={styles.name}>Profile not found</h1>
              <p className={styles.message}>This profile could not be found.</p>
              <a className={styles.button} href="/search">Browse packages</a>
            </T>
          </div>
        )}
        {profile && (
          <>
            <header className={styles.summary}>
              <Avatar.Root className={styles.avatar} aria-hidden="true">
                <Avatar.Image className={styles.avatarImage} src={profile.imageUrl} />
                <Avatar.Fallback>{name.slice(0, 1).toUpperCase()}</Avatar.Fallback>
              </Avatar.Root>
              <div>
                <h1 className={styles.name}>{name}</h1>
                {profile.username && (
                  <p className={styles.username}>@{profile.username}</p>
                )}
                <p className={styles.message}>
                  <T>
                    Joined{' '}
                    <Var>
                      <time dateTime={profile.createdAt}>
                        {new Date(profile.createdAt).toLocaleDateString(locale)}
                      </time>
                    </Var>
                  </T>
                </p>
              </div>
            </header>

            <section aria-labelledby="profile-packages">
              <h2 className={styles.heading} id="profile-packages">
                <Package size={20} aria-hidden="true" />
                <T>
                  <Num>{profile.total}</Num>{' '}
                  <Plural n={profile.total} one="package">packages</Plural>
                </T>
              </h2>
              {profile.total === 0 && (
                <p className={styles.message}>
                  <T>No packages published yet.</T>
                </p>
              )}
              {profile.total > 0 && profile.packages.length === 0 && (
                <p className={styles.message}>
                  <T>No packages on this page.</T>
                </p>
              )}
              <ul className={styles.results} aria-label={gt('Packages')}>
                {profile.packages.map(pkg => (
                  <PackageListItem key={pkg.name} pkg={pkg} />
                ))}
              </ul>
              {profile.total > pageSize && (
                <nav className={styles.pagination} aria-label={gt('Profile packages pages')}>
                  {page > 1 && (
                    <a className={styles.button} href={`/profile/${id}?page=${page - 1}`}>
                      <T>Previous</T>
                    </a>
                  )}
                  <span>
                    <T>Page <Num>{page}</Num></T>
                  </span>
                  {page * pageSize < profile.total && page < 501 && (
                    <a className={styles.button} href={`/profile/${id}?page=${page + 1}`}>
                      <T>Next</T>
                    </a>
                  )}
                </nav>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
