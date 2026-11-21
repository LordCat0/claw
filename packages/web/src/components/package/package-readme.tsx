import { T, useGT } from 'gt-react';
import Markdown, { type ReactRenderer } from 'marked-react';
import type { ReactNode } from 'preact/compat';
import * as styles from './package-readme.css';

interface PackageReadmeProps {
  readme: string;
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

  return (
    <article className={styles.readme} aria-label={gt('Readme')}>
      {props.readme.trim() && (
        <Markdown
          value={props.readme}
          renderer={renderer}
        />)
      }
      {!props.readme.trim() && (
        <p>
          <T>No readme has been provided for this package.</T>
        </p>
      )}
    </article>
  );
}
