import { Button } from '@base-ui/react/button';
import { Avatar } from '@base-ui/react/avatar';
import { Check, Copy, Download, GitFork, Link, Terminal } from 'lucide-preact';
import { useMemo, useState } from 'preact/hooks';
import { Sparklines, SparklinesLine } from 'react-sparklines';
import type { PackageMetadata } from 'shared';
import { theme } from '../../styles/theme.css';
import * as styles from './package-sidebar.css';

interface PackageSidebarProps {
  pkg: PackageMetadata;
}

export default function PackageSidebar(props: PackageSidebarProps) {
  const pkg = props.pkg;
  const [copyStatus, setCopyStatus] = useState('');
  const command = `claw install ${pkg.name}`;
  const downloads = useMemo(
    () => pkg.downloads.daily.map(day => day.downloads),
    [pkg.downloads.daily]
  );
  const copyCommand = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopyStatus('Copied to clipboard');
    } catch {
      setCopyStatus('Could not copy. Select the command to copy it.');
    }
  };

  return (
    <aside className={styles.sidebar} aria-label="Package details">
      <section className={styles.install}>
        <h2 className={styles.label}>Install</h2>
        <div className={styles.command}>
          <Terminal size={16} aria-hidden="true" />
          <code className={styles.commandText}>{command}</code>
          <Button className={styles.copy} aria-label="Copy install command" onClick={copyCommand}>
            {copyStatus === 'Copied to clipboard' && <Check size={16} aria-hidden="true" />}
            {copyStatus !== 'Copied to clipboard' && <Copy size={16} aria-hidden="true" />}
          </Button>
        </div>
        {copyStatus && <p className={styles.copyStatus} role="status">{copyStatus}</p>}
      </section>

      {pkg.repository && (
        <section className={styles.section}>
          <h2 className={styles.label}>Repository</h2>
          <a className={styles.link} href={pkg.repository}>
            <GitFork size={17} aria-hidden="true" />
            {pkg.repository.replace(/^https?:\/\//, '')}
          </a>
        </section>
      )}
      {pkg.homepage && (
        <section className={styles.section}>
          <h2 className={styles.label}>Homepage</h2>
          <a className={styles.link} href={pkg.homepage}>
            <Link size={17} aria-hidden="true" />
            {pkg.homepage.replace(/^https?:\/\//, '')}
          </a>
        </section>
      )}

      <section className={styles.section}>
        <h2 className={styles.label}>
          <Download size={14} aria-hidden="true" /> Weekly downloads
        </h2>
        <div className={styles.downloads}>
          <strong className={styles.total}>{pkg.downloads.total.toLocaleString()}</strong>
          <div
            className={styles.chart}
            role="img"
            aria-label={`Daily downloads: ${pkg.downloads.daily.map(
              day => `${day.date}: ${day.downloads.toLocaleString()}`
            ).join(', ')}`}
          >
            <Sparklines data={downloads} width={180} height={44} min={0}>
              <SparklinesLine color={theme.brand.primary} style={{ strokeWidth: 2 }} />
            </Sparklines>
          </div>
        </div>
        <p className={styles.period}>
          <time dateTime={pkg.downloads.start}>{pkg.downloads.start}</time>
          {' – '}
          <time dateTime={pkg.downloads.end}>{pkg.downloads.end}</time>
        </p>
      </section>

      <dl className={styles.facts}>
        <div>
          <dt className={styles.label}>Version</dt>
          <dd className={styles.value}>{pkg.version}</dd>
        </div>
        <div>
          <dt className={styles.label}>License</dt>
          <dd className={styles.value}>{pkg.license || 'Not specified'}</dd>
        </div>
        <div className={styles.lastPublish}>
          <dt className={styles.label}>Last publish</dt>
          <dd className={styles.value}>
            <time dateTime={pkg.lastPublishedAt}>
              {new Date(pkg.lastPublishedAt).toLocaleDateString()}
            </time>
          </dd>
        </div>
      </dl>

      {pkg.collaborators.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.label}>Collaborators</h2>
          <ul className={styles.collaborators}>
            {pkg.collaborators.map(user => (
              <li className={styles.collaborator} key={user.id}>
                <Avatar.Root className={styles.avatar} aria-hidden="true">
                  <Avatar.Image className={styles.avatarImage} src={user.imageUrl} />
                  <Avatar.Fallback>
                    {(user.username || user.fullName || '?').slice(0, 1).toUpperCase()}
                  </Avatar.Fallback>
                </Avatar.Root>
                {user.username || user.fullName || 'Package owner'}
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  );
}
