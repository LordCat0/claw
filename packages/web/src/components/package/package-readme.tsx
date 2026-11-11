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

function renderLink(this: ReactRenderer, href: string, text: ReactNode) {
  return <a key={this.elementId} href={markdownUrl(href)}>{text}</a>;
}

function renderImage(this: ReactRenderer, src: string, alt: string, title?: string | null) {
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

const renderer = {
  link: renderLink,
  image: renderImage
};

export default function PackageReadme(props: PackageReadmeProps) {
  return (
    <article className={styles.readme} aria-label="Readme">
      {props.readme.trim() && <Markdown value={props.readme} renderer={renderer} />}
      {!props.readme.trim() && <p>No readme has been provided for this package.</p>}
    </article>
  );
}
