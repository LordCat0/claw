import { Button } from '@base-ui/react/button';
import { Tabs } from '@base-ui/react/tabs';
import { useQuery } from '@tanstack/react-query';
import { Num, Plural, T, useGT, useLocale, Var } from 'gt-react';
import { BookOpen, Boxes, Code, Package as PackageIcon, Tags } from 'lucide-preact';
import Header from '../components/header/header';
import PackageCode from '../components/package/package-code';
import PackageDependents from '../components/package/package-dependents';
import PackageReadme from '../components/package/package-readme';
import PackageSidebar from '../components/package/package-sidebar';
import UserLink from '../components/user-link/user-link';
import { env } from '../config';
import type { PackageMetadata } from 'shared';
import * as styles from './package.css';

interface PackageProps {
  name?: string;
}

export default function Package(props: PackageProps) {
  const gt = useGT();
  const locale = useLocale();
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
          <p className={styles.message} role="status"><T>Loading package…</T></p>
        )}
        {isError && (
          <div className={styles.message} role="alert">
            <p><T>Could not load this package. Please try again.</T></p>
            <Button className={styles.button} onClick={() => refetch()}>
              <T>Try again</T>
            </Button>
          </div>
        )}
        {pkg === null && (
          <div>
            <T>
              <h1 className={styles.heading}>Package not found</h1>
              <p className={styles.message}>This package could not be found.</p>
              <a className={styles.link} href="/search">Browse packages</a>
            </T>
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
                <span className={styles.visibility}>
                  {pkg.visibility === 'public' ? <T>public</T> : pkg.visibility}
                </span>
                <span>
                  <T>
                    Published{' '}
                    <Var>
                      <time dateTime={pkg.publishedAt}>
                        {new Date(pkg.publishedAt).toLocaleDateString(locale)}
                      </time>
                    </Var>
                  </T>
                </span>
              </div>
              {pkg.description && (
                <p className={styles.description}>{pkg.description}</p>
              )}
            </header>

            <Tabs.Root key={name} defaultValue="readme">
              <Tabs.List className={styles.tabs} aria-label={gt('Package information')}>
                <Tabs.Tab className={styles.tab} value="readme">
                  <BookOpen size={17} aria-hidden="true" />
                  <T>Readme</T>
                </Tabs.Tab>
                <Tabs.Tab className={styles.tab} value="code">
                  <Code size={17} aria-hidden="true" />
                  <T>Code</T>
                </Tabs.Tab>
                <Tabs.Tab className={styles.tab} value="dependencies">
                  <PackageIcon size={17} aria-hidden="true" />
                  <T>
                    <Num>{pkg.dependencyCount}</Num>{' '}
                    <Plural n={pkg.dependencyCount} one="Dependency">Dependencies</Plural>
                  </T>
                </Tabs.Tab>
                <Tabs.Tab className={styles.tab} value="dependents">
                  <Boxes size={17} aria-hidden="true" />
                  <T>
                    <Num>{pkg.dependentCount}</Num>{' '}
                    <Plural n={pkg.dependentCount} one="Dependent">Dependents</Plural>
                  </T>
                </Tabs.Tab>
                <Tabs.Tab className={styles.tab} value="versions">
                  <Tags size={17} aria-hidden="true" />
                  <T>
                    <Num>{pkg.versionCount}</Num>{' '}
                    <Plural n={pkg.versionCount} one="Version">Versions</Plural>
                  </T>
                </Tabs.Tab>
              </Tabs.List>

              <div className={styles.layout}>
                <div className={styles.content}>
                  <Tabs.Panel value="readme">
                    <PackageReadme readme={pkg.readme} />
                    {pkg.keywords.length > 0 && (
                      <section className={styles.keywords} aria-label={gt('Keywords')}>
                        <h2 className={styles.subheading}><T>Keywords</T></h2>
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
                  <Tabs.Panel value="code">
                    <PackageCode
                      key={`${pkg.name}@${pkg.version}`}
                      name={pkg.name}
                      version={pkg.version}
                    />
                  </Tabs.Panel>
                  <Tabs.Panel value="dependencies">
                    <h2 className={styles.subheading}><T>Dependencies</T></h2>
                    {pkg.dependencyCount === 0 && (
                      <p className={styles.message}><T>This package has no dependencies.</T></p>
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
                    <h2 className={styles.subheading}><T>Version history</T></h2>
                    <ul className={styles.list}>
                      {pkg.releases.map(release => (
                        <li className={styles.row} key={release.version}>
                          <div className={styles.release}>
                            <code>{release.version}</code>
                            {release.version === pkg.latest && (
                              <span className={styles.badge}><T>latest</T></span>
                            )}
                            <UserLink
                              id={release.publisherId}
                              className={styles.link}
                            />
                          </div>
                          <time className={styles.message} dateTime={release.publishedAt}>
                            {new Date(release.publishedAt).toLocaleDateString(locale)}
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
