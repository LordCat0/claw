import { Clock3, Package, Tag } from 'lucide-preact';
import type { SearchPackage } from '../../types/search';
import * as styles from './package-list-item.css';

interface PackageListItemProps {
  pkg: SearchPackage;
};

export default function PackageListItem(props: PackageListItemProps) {
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
          Published
          <time dateTime={pkg.publishedAt}>
            {new Date(pkg.publishedAt).toLocaleDateString()}
          </time>
        </span>
        <span className={styles.detail}>
          <Package size={15} aria-hidden="true" />
          {pkg.versions} {pkg.versions === 1 ? 'version' : 'versions'}
        </span>
      </div>
    </li>
  );
}
