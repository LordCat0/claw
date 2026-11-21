import { Num, Plural, T, useLocale, Var } from 'gt-react';
import { Clock3, Package, Tag } from 'lucide-preact';
import type { SearchPackage } from 'shared';
import * as styles from './package-list-item.css';

interface PackageListItemProps {
  pkg: SearchPackage;
};

export default function PackageListItem(props: PackageListItemProps) {
  const locale = useLocale();
  const pkg = props.pkg;

  return (
    <li className={styles.result}>
      <h2 className={styles.name}>
        <a className={styles.link} href={`/package/${pkg.name}`}>{pkg.name}</a>
      </h2>
      {pkg.description && (
        <p className={styles.description}>{pkg.description}</p>
      )}
      <div className={styles.metadata}>
        <span className={styles.detail}>
          <Tag size={15} aria-hidden="true" />
          <span className={styles.version}>{pkg.version}</span>
        </span>
        <span className={styles.detail}>
          <Clock3 size={15} aria-hidden="true" />
          <T>
            Published{' '}
            <Var>
              <time dateTime={pkg.publishedAt}>
                {new Date(pkg.publishedAt).toLocaleDateString(locale)}
              </time>
            </Var>
          </T>
        </span>
        <span className={styles.detail}>
          <Package size={15} aria-hidden="true" />
          <T>
            <Num>{pkg.versions}</Num>{' '}
            <Plural n={pkg.versions} one="version">versions</Plural>
          </T>
        </span>
      </div>
    </li>
  );
}
