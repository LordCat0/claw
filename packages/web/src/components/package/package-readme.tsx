import { useQuery } from '@tanstack/react-query';
import { T, useGT } from 'gt-react';
import Markdown, { type ReactRenderer } from 'marked-react';
import type { ReactNode } from 'preact/compat';
import { env } from '../../config';
import * as styles from './package-readme.css';

interface PackageReadmeProps {
  name: string;
  version: string;
}

function markdownUrl(value: string) {
  try {
    const url = new URL(value, window.location.href);

    if (['http:', 'https:', 'mailto:'].includes(url.protocol)) {
      return value;
    }
  } catch {
    return undefined;
  }
}

const renderer = {
  link: function (this: ReactRenderer, href: string, text: ReactNode) {
    return (
      <a
        key={this.elementId}
        href={markdownUrl(href)}
        >
          {text}
      </a>
    );
  },
  image: function (this: ReactRenderer, src: string, alt: string, title?: string | null) {
    return (
      <img
        key={this.elementId}
        src={markdownUrl(src)}
        alt={alt}
        title={title || undefined}
        loading="lazy"
      />
    );
  }
};

export default function PackageReadme(props: PackageReadmeProps) {
  const gt = useGT();
  const { data: readme, isPending, isError } = useQuery({
    queryKey: ['package-file', props.name, props.version, 'README.md'],
    queryFn: async ({ signal }): Promise<string> => {
      const response = await fetch(
        `${env.apiUrl}/packages/${encodeURIComponent(props.name)}`
          + `/${encodeURIComponent(props.version)}/file?path=README.md`,
        { signal }
      );

      if (response.status === 404) {
        return '';
      }

      if (!response.ok) {
        throw new Error(`GET ${response.url} failed (${response.status})`);
      }

      return response.text();
    }
  });

  return (
    <article className={styles.readme} aria-label={gt('Readme')}>
      {isPending && <p role="status"><T>Loading readme…</T></p>}
      {isError && <p role="alert"><T>Could not load this readme.</T></p>}
      {readme?.trim() && (
        <Markdown
          value={readme}
          renderer={renderer}
        />)
      }
      {readme !== undefined && !readme.trim() && (
        <p>
          <T>No readme has been provided for this package.</T>
        </p>
      )}
    </article>
  );
}
