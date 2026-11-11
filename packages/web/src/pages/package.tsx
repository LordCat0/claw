import { Button } from '@base-ui/react/button';
import { Tabs } from '@base-ui/react/tabs';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Boxes, Package as PackageIcon, Tags } from 'lucide-preact';
import Header from '../components/header/header';
import PackageDependents from '../components/package/package-dependents';
import PackageReadme from '../components/package/package-readme';
import PackageSidebar from '../components/package/package-sidebar';
import { env } from '../config';
import type { PackageMetadata } from '../types/package';
import * as styles from './package.css';

interface PackageProps {
  name?: string;
}

export default function Package(props: PackageProps) {
  const name = props.name || '';
  const { data: pkg, isPending, isError, refetch } = useQuery({
    queryKey: ['package', name],
    queryFn: async ({ signal }): Promise<PackageMetadata | null> => {
      const response = await fetch(
        `${env.apiUrl}/packages/${encodeURIComponent(name)}`,
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

  return (
    <div>
      <Header query="" />
      <main className={styles.main}>
        {isPending && (
          <p className={styles.message} role="status">Loading package…</p>
        )}
        {isError && (
          <div className={styles.message} role="alert">
            <p>Could not load this package. Please try again.</p>
            <Button className={styles.button} onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        )}
        {pkg === null && (
          <div>
            <h1 className={styles.heading}>Package not found</h1>
            <p className={styles.message}>This package could not be found.</p>
            <a className={styles.link} href="/search">Browse packages</a>
          </div>
        )}
        {pkg && (
          <>
            <header className={styles.summary}>
              <h1 className={styles.heading}>
                <PackageIcon size={28} className={styles.packageIcon} aria-hidden="true" />
                {pkg.name}
              </h1>
              <div className={styles.metadata}>
                <span className={styles.monospace}>{pkg.version}</span>
                <span className={styles.visibility}>{pkg.visibility}</span>
                <span>
                  Published{' '}
                  <time dateTime={pkg.publishedAt}>
                    {new Date(pkg.publishedAt).toLocaleDateString()}
                  </time>
                </span>
              </div>
              {pkg.description && (
                <p className={styles.description}>{pkg.description}</p>
              )}
            </header>

            <Tabs.Root key={name} defaultValue="readme">
              <Tabs.List className={styles.tabs} aria-label="Package information">
                <Tabs.Tab className={styles.tab} value="readme">
                  <BookOpen size={17} aria-hidden="true" /> Readme
                </Tabs.Tab>
                <Tabs.Tab className={styles.tab} value="dependencies">
                  <PackageIcon size={17} aria-hidden="true" />
                  {pkg.dependencyCount.toLocaleString()} Dependencies
                </Tabs.Tab>
                <Tabs.Tab className={styles.tab} value="dependents">
                  <Boxes size={17} aria-hidden="true" />
                  {pkg.dependentCount.toLocaleString()} Dependents
                </Tabs.Tab>
                <Tabs.Tab className={styles.tab} value="versions">
                  <Tags size={17} aria-hidden="true" />
                  {pkg.versionCount.toLocaleString()} Versions
                </Tabs.Tab>
              </Tabs.List>

              <div className={styles.layout}>
                <div className={styles.content}>
                  <Tabs.Panel value="readme">
                    <PackageReadme readme={pkg.readme} />
                    {pkg.keywords.length > 0 && (
                      <section className={styles.keywords} aria-label="Keywords">
                        <h2 className={styles.subheading}>Keywords</h2>
                        <div className={styles.keywordList}>
                          {pkg.keywords.map(keyword => (
                            <a
                              key={keyword}
                              className={styles.keyword}
                              href={`/search?${new URLSearchParams({ q: keyword })}`}
                            >
                              {keyword}
                            </a>
                          ))}
                        </div>
                      </section>
                    )}
                  </Tabs.Panel>
                  <Tabs.Panel value="dependencies">
                    <h2 className={styles.subheading}>Dependencies</h2>
                    {pkg.dependencyCount === 0 && (
                      <p className={styles.message}>This package has no dependencies.</p>
                    )}
                    <ul className={styles.list}>
                      {Object.entries(pkg.dependencies).map(([dependency, version]) => (
                        <li className={styles.row} key={dependency}>
                          <a className={styles.link} href={`/package/${dependency}`}>
                            {dependency}
                          </a>
                          <code className={styles.message}>{version}</code>
                        </li>
                      ))}
                    </ul>
                  </Tabs.Panel>
                  <Tabs.Panel value="dependents">
                    <PackageDependents name={pkg.name} />
                  </Tabs.Panel>
                  <Tabs.Panel value="versions">
                    <h2 className={styles.subheading}>Version history</h2>
                    <ul className={styles.list}>
                      {pkg.releases.map(release => (
                        <li className={styles.row} key={release.version}>
                          <div className={styles.release}>
                            <code>{release.version}</code>
                            {release.version === pkg.latest && (
                              <span className={styles.badge}>latest</span>
                            )}
                          </div>
                          <time className={styles.message} dateTime={release.publishedAt}>
                            {new Date(release.publishedAt).toLocaleDateString()}
                          </time>
                        </li>
                      ))}
                    </ul>
                  </Tabs.Panel>
                </div>
                <PackageSidebar key={name} pkg={pkg} />
              </div>
            </Tabs.Root>
          </>
        )}
      </main>
    </div>
  );
}
