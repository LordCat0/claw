import { Button } from '@base-ui/react/button';
import { Avatar } from '@base-ui/react/avatar';
import { Num, T, useGT, useLocale } from 'gt-react';
import { Check, Copy, Download, GitFork, Link, Terminal } from 'lucide-preact';
import { useMemo, useState } from 'preact/hooks';
import { Sparklines, SparklinesLine } from 'react-sparklines';
import type { PackageMetadata } from 'shared';
import { theme } from '../../styles/theme.css';
import UserLink from '../user-link/user-link';
import * as styles from './package-sidebar.css';

interface PackageSidebarProps {
  pkg: PackageMetadata;
}

export default function PackageSidebar(props: PackageSidebarProps) {
  const gt = useGT();
  const locale = useLocale();
  const pkg = props.pkg;
  const [copied, setCopied] = useState<boolean | null>(null);
  const command = `claw install ${pkg.name}`;
  const downloads = useMemo(
    () => pkg.downloads.daily.map(day => day.downloads),
    [pkg.downloads.daily]
  );
  const copyCommand = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <aside className={styles.sidebar} aria-label={gt('Package details')}>
      <section className={styles.install}>
        <h2 className={styles.label}><T>Install</T></h2>
        <div className={styles.command}>
          <Terminal size={16} aria-hidden="true" />
          <code className={styles.commandText}>{command}</code>
          <Button className={styles.copy} aria-label={gt('Copy install command')} onClick={copyCommand}>
            {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
          </Button>
        </div>
        {copied !== null && (
          <p className={styles.copyStatus} role="status">
            {copied ? (
              <T>Copied to clipboard</T>
            ) : <T>Could not copy. Select the command to copy it.</T>}
          </p>
        )}
      </section>

      {pkg.repository && (
        <section className={styles.section}>
          <h2 className={styles.label}><T>Repository</T></h2>
          <a className={styles.link} href={pkg.repository}>
            <GitFork size={17} aria-hidden="true" />
            {pkg.repository.replace(/^https?:\/\//, '')}
          </a>
        </section>
      )}
      {pkg.homepage && (
        <section className={styles.section}>
          <h2 className={styles.label}><T>Homepage</T></h2>
          <a className={styles.link} href={pkg.homepage}>
            <Link size={17} aria-hidden="true" />
            {pkg.homepage.replace(/^https?:\/\//, '')}
          </a>
        </section>
      )}

      <section className={styles.section}>
        <h2 className={styles.label}>
          <Download size={14} aria-hidden="true" />
          <T>Weekly downloads</T>
        </h2>
        <div className={styles.downloads}>
          <strong className={styles.total}><Num>{pkg.downloads.total}</Num></strong>
          <div
            className={styles.chart}
            role="img"
            aria-label={gt('Daily downloads: {days}', {
              days: pkg.downloads.daily.map(
                day => `${day.date}: ${day.downloads.toLocaleString(locale)}`
              ).join(', ')
            })}
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
          <dt className={styles.label}><T>Version</T></dt>
          <dd className={styles.value}>{pkg.version}</dd>
        </div>
        <div>
          <dt className={styles.label}><T>License</T></dt>
          <dd className={styles.value}>{pkg.license || <T>Not specified</T>}</dd>
        </div>
        <div className={styles.lastPublish}>
          <dt className={styles.label}><T>Last publish</T></dt>
          <dd className={styles.value}>
            <time dateTime={pkg.lastPublishedAt}>
              {new Date(pkg.lastPublishedAt).toLocaleDateString(locale)}
            </time>
          </dd>
        </div>
      </dl>

      {pkg.collaborators.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.label}><T>Collaborators</T></h2>
          <ul className={styles.collaborators}>
            {pkg.collaborators.map(user => (
              <li className={styles.collaborator} key={user.id}>
                <Avatar.Root className={styles.avatar} aria-hidden="true">
                  <Avatar.Image className={styles.avatarImage} src={user.imageUrl} />
                  <Avatar.Fallback>
                    {(user.username || user.fullName || gt('Unknown')).slice(0, 1).toUpperCase()}
                  </Avatar.Fallback>
                </Avatar.Root>
                <UserLink id={user.id} className={styles.collaborator} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  );
}
